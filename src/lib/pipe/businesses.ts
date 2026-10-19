import "server-only";

import { CustomerStatus, Prisma } from "@prisma/client";
import { createBrandDataContext, withBrandDataTransaction } from "@/lib/tenancy/context";
import { resolveBrand } from "./contacts";

/**
 * Businesses written by the `pipe` terminal tool (LochsideLLC/sales).
 *
 * Same shape as the contacts route: pipe authenticates with the shared
 * secret, writes land in the brand-scoped transaction, and the account is
 * created once (first writer wins on its fields). The people links are
 * upserted every time, so a retry or a later link still lands. pipe sends
 * snake_case; camelCase is accepted too.
 */

export const PIPE_ROLES = ["owner", "partner", "rep", "other", "contact"] as const;
export type PipeRole = (typeof PIPE_ROLES)[number];

const DECIDER_ROLES: ReadonlySet<string> = new Set(["owner", "partner"]);

/** Raw person entry as pipe sends it, either casing. */
export type PipeBusinessPersonInput = {
  contact?: string | null;
  contactId?: string | null;
  contact_id?: string | null;
  role?: string | null;
  can_decide?: boolean | null;
  canDecide?: boolean | null;
  primary?: boolean | null;
  is_primary?: boolean | null;
};

/** Raw business body as pipe sends it, either casing. */
export type PipeBusinessRawInput = {
  brand?: string | null;
  name?: string | null;
  legal_name?: string | null;
  legalName?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  people?: PipeBusinessPersonInput[] | null;
};

export type ParsedPipeBusinessPerson = {
  /** The SWapp contact id pipe got back when it sent the contact. */
  contact: string;
  role: PipeRole;
  canDecide: boolean | null;
  primary: boolean;
};

export type PipeBusinessInput = {
  brand: string;
  name: string;
  legalName: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  people: ParsedPipeBusinessPerson[];
};

export type PipeBusinessPerson = {
  contactId: string;
  contactName: string | null;
  role: string;
  canDecide: boolean;
  primary: boolean;
};

export type PipeBusiness = {
  id: string;
  brand: string;
  name: string;
  legalName: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  people: PipeBusinessPerson[];
  updatedAt: string;
};

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

function cleanBool(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function parseRole(value: unknown): PipeRole {
  if (value === null || value === undefined || value === "") return "contact";
  const role = String(value).trim().toLowerCase();
  if ((PIPE_ROLES as readonly string[]).includes(role)) return role as PipeRole;
  throw new RangeError(`role must be one of: ${PIPE_ROLES.join(", ")}`);
}

export function parsePipeBusinessInput(body: unknown): PipeBusinessInput {
  const raw = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const brand = clean(raw.brand, 80);
  const name = clean(raw.name, 200);
  if (!brand) throw new RangeError("brand is required");
  if (!name) throw new RangeError("name is required");
  const email = clean(raw.email, 254)?.toLowerCase() ?? null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new RangeError("email is not valid");
  const peopleRaw = raw.people;
  const people = peopleRaw === null || peopleRaw === undefined ? [] : peopleRaw;
  if (!Array.isArray(people)) throw new RangeError("people must be a list");
  return {
    brand,
    name,
    legalName: clean(raw.legalName ?? raw.legal_name, 200) ?? null,
    phone: clean(raw.phone, 64) ?? null,
    email,
    website: clean(raw.website, 254) ?? null,
    people: people.map((entry) => {
      const person = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
      const contact = clean(person.contact ?? person.contactId ?? person.contact_id, 64);
      if (!contact) throw new RangeError("every person needs a contact id");
      return {
        contact,
        role: parseRole(person.role),
        canDecide: cleanBool(person.canDecide ?? person.can_decide),
        primary: cleanBool(person.primary ?? person.is_primary) ?? false,
      };
    }),
  };
}

type AccountRow = Prisma.CustomerAccountGetPayload<{ select: typeof select }>;

function present(slug: string, row: AccountRow): PipeBusiness {
  const people = [...row.contacts].sort(
    (a, b) => Number(b.isPrimary) - Number(a.isPrimary) || Number(b.canDecide) - Number(a.canDecide),
  );
  return {
    id: row.id,
    brand: slug,
    name: row.name,
    legalName: row.legalName,
    phone: row.primaryPhone,
    email: row.communicationEmail,
    website: row.websiteUrl,
    people: people.map((link) => ({
      contactId: link.contactId,
      contactName: link.contact.name,
      role: link.relationship ?? "contact",
      canDecide: link.canDecide,
      primary: link.isPrimary,
    })),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const select = {
  id: true,
  name: true,
  legalName: true,
  primaryPhone: true,
  communicationEmail: true,
  websiteUrl: true,
  updatedAt: true,
  contacts: {
    select: {
      contactId: true,
      relationship: true,
      isPrimary: true,
      canDecide: true,
      contact: { select: { name: true } },
    },
  },
} as const;

export type PipeBusinessUpsert = {
  created: boolean;
  business: PipeBusiness;
  linked: number;
  skipped: { contact: string; reason: string }[];
};

/**
 * Create the business unless this brand already has one by that name, in
 * which case the existing one is kept and nothing on it is changed. The
 * people links are applied in both cases: a link names a SWapp contact id,
 * a role, and who decides. Unknown contact ids are skipped and reported,
 * never created.
 */
export async function upsertPipeBusiness(args: {
  actorUserId: string;
  input: PipeBusinessInput;
}): Promise<PipeBusinessUpsert> {
  const { input } = args;
  const brand = await resolveBrand(input.brand);
  const context = createBrandDataContext({ brandId: brand.id, actorUserId: args.actorUserId });
  return withBrandDataTransaction(context, async (transaction) => {
    const existing = await transaction.customerAccount.findFirst({
      where: { brandId: brand.id, name: { equals: input.name, mode: "insensitive" } },
      select,
      orderBy: { createdAt: "asc" },
    });
    let account = existing;
    let created = false;
    if (!account) {
      account = await transaction.customerAccount.create({
        data: {
          brandId: brand.id,
          name: input.name,
          legalName: input.legalName,
          status: CustomerStatus.PROSPECT,
          websiteUrl: input.website,
          communicationEmail: input.email,
          primaryPhone: input.phone,
        },
        select,
      });
      created = true;
    }
    let linked = 0;
    const skipped: { contact: string; reason: string }[] = [];
    for (const person of input.people) {
      const contact = await transaction.contact.findFirst({
        where: { brandId: brand.id, id: person.contact },
        select: { id: true },
      });
      if (!contact) {
        skipped.push({ contact: person.contact, reason: "unknown contact" });
        continue;
      }
      const canDecide = person.canDecide ?? DECIDER_ROLES.has(person.role);
      await transaction.customerContact.upsert({
        where: {
          brandId_customerAccountId_contactId: {
            brandId: brand.id,
            customerAccountId: account.id,
            contactId: contact.id,
          },
        },
        create: {
          brandId: brand.id,
          customerAccountId: account.id,
          contactId: contact.id,
          relationship: person.role,
          isPrimary: person.primary,
          canDecide,
        },
        update: { relationship: person.role, isPrimary: person.primary, canDecide },
        select: { id: true },
      });
      linked += 1;
    }
    if (linked > 0 || created) {
      const fresh = await transaction.customerAccount.findUniqueOrThrow({
        where: { id: account.id },
        select,
      });
      return { created, business: present(brand.slug, fresh), linked, skipped };
    }
    return { created, business: present(brand.slug, account), linked, skipped };
  });
}

export async function listPipeBusinesses(args: {
  actorUserId: string;
  brand: string;
  query?: string;
}): Promise<PipeBusiness[]> {
  const brand = await resolveBrand(args.brand);
  const context = createBrandDataContext({ brandId: brand.id, actorUserId: args.actorUserId });
  const q = args.query?.trim();
  const rows = await withBrandDataTransaction(context, (transaction) =>
    transaction.customerAccount.findMany({
      where: {
        brandId: brand.id,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { legalName: { contains: q, mode: "insensitive" } },
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
