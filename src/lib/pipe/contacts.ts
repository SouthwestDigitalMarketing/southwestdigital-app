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

const NAME_TITLES: ReadonlySet<string> = new Set(["mr", "mrs", "ms", "dr", "miss"]);

function nameWords(name: string | null | undefined): string[] {
  return (name ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word && !NAME_TITLES.has(word));
}

function wordFits(word: string, others: string[]): boolean {
  return others.some(
    (other) =>
      word === other ||
      (word.length === 1 && other.startsWith(word)) ||
      (other.length === 1 && word.startsWith(other)),
  );
}

/**
 * Names that plausibly belong to one person: equal, or one holds the other
 * ("Dana" is "Dana Reyes", but "Lopez" is not "Rosa Lopez" — a shared
 * surname). Titles and punctuation are ignored. The same rule pipe uses
 * when it matches by phone, so one office line never merges two people.
 */
export function samePerson(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = nameWords(a);
  const right = nameWords(b);
  if (left.length === 0 || right.length === 0) return true;
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  if (shorter.length === 1) return wordFits(shorter[0], longer.slice(0, 1));
  return shorter.every((word) => wordFits(word, longer));
}

export type PipeContactInput = {
  brand: string;
  name: string;
  /** pipe sends snake_case; camelCase is accepted too. */
  first_name?: string | null;
  last_name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  /** datastore id for updates and deletes. */
  id?: string | null;
  /** true deletes the card instead of writing it. */
  deleted?: boolean | null;
};

export type PipeContact = {
  id: string;
  brand: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  phoneE164: string | null;
  updatedAt: string;
};

/** First and last name from a full name, the same split pipe uses. */
export function splitPipeName(name: string | null | undefined): [string | null, string | null] {
  const words = (name ?? "").split(/\s+/).filter(Boolean);
  while (words.length > 1 && /^(mr|mrs|ms|dr|miss)\.?$/i.test(words[0])) words.shift();
  if (words.length === 0) return [null, null];
  if (words.length === 1) return [words[0], null];
  return [words[0], words[words.length - 1]];
}

export class PipeBrandError extends Error {}

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

export function parsePipeContactInput(body: unknown): PipeContactInput {
  const raw = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const brand = clean(raw.brand, 80);
  const id = clean(raw.id, 64);
  const deleted = raw.deleted === true;
  const name = clean(raw.name, 200);
  if (!brand) throw new RangeError("brand is required");
  if (!name && !deleted) throw new RangeError("name is required");
  const email = clean(raw.email, 254)?.toLowerCase() ?? null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new RangeError("email is not valid");
  const [splitFirst, splitLast] = splitPipeName(name);
  return {
    brand,
    name: name ?? "",
    firstName: clean(raw.firstName ?? raw.first_name, 100) ?? splitFirst,
    lastName: clean(raw.lastName ?? raw.last_name, 100) ?? splitLast,
    company: clean(raw.company, 200),
    email,
    phone: clean(raw.phone, 64),
    id,
    deleted,
  };
}

export async function resolveBrand(slug: string) {
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
  firstName: string | null;
  lastName: string | null;
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
    firstName: row.firstName,
    lastName: row.lastName,
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
  firstName: true,
  lastName: true,
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
 * Create the contact unless this brand already has the same person, in
 * which case that contact is returned and nothing is changed. An email
 * match is the same person. A phone match counts only when the names fit
 * too, because an office line is shared by several people. The same person
 * under another brand is a separate contact, by design.
 */
export type PipeContactUpsert =
  | { created: true; contact: PipeContact }
  | { created: false; updated: true; contact: PipeContact }
  | { deleted: true }
  | { skipped: { field: string; id: string; reason: string }[] };

const live = { isActive: true } as const;

export async function upsertPipeContact(args: {
  actorUserId: string;
  input: PipeContactInput;
}): Promise<PipeContactUpsert> {
  const { input } = args;
  const brand = await resolveBrand(input.brand);
  const context = createBrandDataContext({ brandId: brand.id, actorUserId: args.actorUserId });
  const phoneE164 = toE164(input.phone);
  return withBrandDataTransaction(context, async (transaction) => {
    if (input.id) {
      const byId = await transaction.contact.findFirst({
        where: { brandId: brand.id, id: input.id },
        select,
      });
      if (byId) {
        if (input.deleted) {
          await transaction.contact.update({
            where: { id: byId.id },
            data: { isActive: false },
            select: { id: true },
          });
          return { deleted: true as const };
        }
        const row = await transaction.contact.update({
          where: { id: byId.id },
          data: {
            name: input.name,
            firstName: input.firstName ?? null,
            lastName: input.lastName ?? null,
            company: input.company ?? null,
            email: input.email ?? null,
            phoneNumber: input.phone ?? null,
            phoneE164,
            // An update is a living card: it lifts a soft delete.
            isActive: true,
          },
          select,
        });
        return { created: false, updated: true, contact: present(brand.slug, row) };
      }
      if (input.deleted) {
        return { skipped: [{ field: "id", id: input.id, reason: "unknown id" }] };
      }
    }
    const byEmail = input.email
      ? await transaction.contact.findFirst({
          where: {
            brandId: brand.id,
            ...live,
            email: { equals: input.email, mode: "insensitive" as const },
          },
          select,
          orderBy: { createdAt: "asc" },
        })
      : null;
    if (byEmail && !input.deleted) {
      const row = await transaction.contact.update({
        where: { id: byEmail.id },
        data: {
          name: input.name,
          firstName: input.firstName ?? null,
          lastName: input.lastName ?? null,
          company: input.company ?? null,
          phoneNumber: input.phone ?? null,
          phoneE164,
        },
        select,
      });
      return { created: false, updated: true, contact: present(brand.slug, row) };
    }
    if (phoneE164 && !input.deleted) {
      const byPhone = await transaction.contact.findFirst({
        where: { brandId: brand.id, ...live, phoneE164 },
        select,
        orderBy: { createdAt: "asc" },
      });
      if (byPhone && samePerson(input.name, byPhone.name)) {
        const row = await transaction.contact.update({
          where: { id: byPhone.id },
          data: {
            name: input.name,
            firstName: input.firstName ?? null,
            lastName: input.lastName ?? null,
            company: input.company ?? null,
            email: input.email ?? null,
            phoneNumber: input.phone ?? null,
            phoneE164,
          },
          select,
        });
        return { created: false, updated: true, contact: present(brand.slug, row) };
      }
    }
    if (input.deleted) {
      return { skipped: [{ field: "id", id: input.id ?? "", reason: "unknown id" }] };
    }
    const row = await transaction.contact.create({
      data: {
        brandId: brand.id,
        name: input.name,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
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
