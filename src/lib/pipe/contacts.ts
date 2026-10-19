import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { BrandStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createBrandDataContext, withBrandDataTransaction } from "@/lib/tenancy/context";

/**
 * Contacts written by the `pipe` terminal tool (LochsideLLC/sales).
 *
 * `pipe` is not a browser session, so it authenticates with one shared secret.
 * Only the SHA-256 of that secret is configured here (PIPE_API_TOKEN_SHA256);
 * the writes are attributed to PIPE_API_ACTOR_USER_ID. Every operation still
 * runs inside the brand-scoped transaction, so row-level security applies.
 */

export type PipeAuth = { ok: true; actorUserId: string } | { ok: false; status: 401 | 503 };

export function authenticatePipeRequest(
  authorization: string | null,
  env: Record<string, string | undefined> = process.env,
): PipeAuth {
  const expected = env.PIPE_API_TOKEN_SHA256?.trim().toLowerCase();
  const actorUserId = env.PIPE_API_ACTOR_USER_ID?.trim();
  if (!expected || !/^[0-9a-f]{64}$/.test(expected) || !actorUserId) {
    return { ok: false, status: 503 };
  }
  const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return { ok: false, status: 401 };
  const presented = createHash("sha256").update(token).digest();
  const wanted = Buffer.from(expected, "hex");
  return timingSafeEqual(presented, wanted) ? { ok: true, actorUserId } : { ok: false, status: 401 };
}

/** E.164 for a US/Canada number or one already written with a leading +. */
export function toE164(raw: string | null | undefined): string | null {
  const text = (raw ?? "").trim();
  if (!text) return null;
  const digits = text.replace(/\D/g, "");
  if (text.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export type PipeContactInput = {
  brand: string;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type PipeContact = {
  id: string;
  brand: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  phoneE164: string | null;
  updatedAt: string;
};

export class PipeBrandError extends Error {}

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

export function parsePipeContactInput(body: unknown): PipeContactInput {
  const raw = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const brand = clean(raw.brand, 80);
  const name = clean(raw.name, 200);
  if (!brand) throw new RangeError("brand is required");
  if (!name) throw new RangeError("name is required");
  const email = clean(raw.email, 254)?.toLowerCase() ?? null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new RangeError("email is not valid");
  return {
    brand,
    name,
    company: clean(raw.company, 200),
    email,
    phone: clean(raw.phone, 64),
  };
}

async function resolveBrand(slug: string) {
  const brand = await prisma.brand.findUnique({
    where: { slug },
    select: { id: true, slug: true, status: true, deletedAt: true },
  });
  if (!brand || brand.deletedAt || brand.status === BrandStatus.DELETED) {
    throw new PipeBrandError(`unknown brand ${slug}`);
  }
  return brand;
}

type Row = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phoneNumber: string | null;
  phoneE164: string | null;
  updatedAt: Date;
};

function present(slug: string, row: Row): PipeContact {
  return {
    id: row.id,
    brand: slug,
    name: row.name,
    company: row.company,
    email: row.email,
    phone: row.phoneNumber,
    phoneE164: row.phoneE164,
    updatedAt: row.updatedAt.toISOString(),
  };
}

const select = {
  id: true,
  name: true,
  company: true,
  email: true,
  phoneNumber: true,
  phoneE164: true,
  updatedAt: true,
} as const;

export async function listPipeContacts(args: {
  actorUserId: string;
  brand: string;
  query?: string;
}): Promise<PipeContact[]> {
  const brand = await resolveBrand(args.brand);
  const context = createBrandDataContext({ brandId: brand.id, actorUserId: args.actorUserId });
  const q = args.query?.trim();
  const digits = q?.replace(/\D/g, "") ?? "";
  const rows = await withBrandDataTransaction(context, (transaction) =>
    transaction.contact.findMany({
      where: {
        brandId: brand.id,
        isActive: true,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { company: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                ...(digits.length >= 4 ? [{ phoneNumber: { contains: digits } }, { phoneE164: { contains: digits } }] : []),
              ],
            }
          : {}),
      },
      select,
      orderBy: [{ name: "asc" }],
      take: 200,
    }),
  );
  return rows.map((row) => present(brand.slug, row));
}

/**
 * Create the contact unless this brand already has one with the same phone or
 * email, in which case that contact is returned and nothing is changed. The
 * same person under another brand is a separate contact, by design.
 */
export async function upsertPipeContact(args: {
  actorUserId: string;
  input: PipeContactInput;
}): Promise<{ created: boolean; contact: PipeContact }> {
  const { input } = args;
  const brand = await resolveBrand(input.brand);
  const context = createBrandDataContext({ brandId: brand.id, actorUserId: args.actorUserId });
  const phoneE164 = toE164(input.phone);
  return withBrandDataTransaction(context, async (transaction) => {
    const matches = [
      ...(phoneE164 ? [{ phoneE164 }] : []),
      ...(input.email ? [{ email: { equals: input.email, mode: "insensitive" as const } }] : []),
    ];
    const existing = matches.length
      ? await transaction.contact.findFirst({
          where: { brandId: brand.id, OR: matches },
          select,
          orderBy: { createdAt: "asc" },
        })
      : null;
    if (existing) return { created: false, contact: present(brand.slug, existing) };
    const row = await transaction.contact.create({
      data: {
        brandId: brand.id,
        name: input.name,
        company: input.company ?? null,
        email: input.email ?? null,
        phoneNumber: input.phone ?? null,
        phoneE164,
      },
      select,
    });
    return { created: true, contact: present(brand.slug, row) };
  });
}
