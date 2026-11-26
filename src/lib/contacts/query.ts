import "server-only";

import type { Prisma } from "@prisma/client";
import {
  CLIENT_RELATIONSHIP_TAG_KEYS,
  type ContactRelationship,
  type ContactSort,
} from "./tags";

export function contactSearchWhere(args: {
  brandId: string;
  q: string;
  status: "all" | "active" | "inactive";
  tagIds: string[];
  clientId?: string;
  relatedBrandId?: string;
  relationship?: ContactRelationship;
}): Prisma.ContactWhereInput {
  const where: Prisma.ContactWhereInput = { brandId: args.brandId };

  if (args.status === "active") where.isActive = true;
  if (args.status === "inactive") where.isActive = false;

  const and: Prisma.ContactWhereInput[] = [];

  if (args.q) {
    and.push({
      OR: [
        { name: { contains: args.q, mode: "insensitive" } },
        { email: { contains: args.q, mode: "insensitive" } },
        { secondaryEmail: { contains: args.q, mode: "insensitive" } },
        { company: { contains: args.q, mode: "insensitive" } },
        { roleTitle: { contains: args.q, mode: "insensitive" } },
        { phoneE164: { contains: args.q } },
      ],
    });
  }

  if (args.tagIds.length > 0) {
    and.push({ tagLinks: { some: { tagId: { in: args.tagIds } } } });
  }

  if (args.clientId) {
    and.push({ clientLinks: { some: { clientId: args.clientId } } });
  }

  if (args.relatedBrandId) {
    and.push({ brandLinks: { some: { relatedBrandId: args.relatedBrandId } } });
  }

  if (args.relationship === "close-friend" || args.relationship === "friend") {
    and.push({ tagLinks: { some: { tag: { key: args.relationship } } } });
  }

  if (args.relationship === "client") {
    and.push({
      OR: [
        { tagLinks: { some: { tag: { key: { in: [...CLIENT_RELATIONSHIP_TAG_KEYS] } } } } },
        { clientLinks: { some: {} } },
      ],
    });
  }

  if (and.length > 0) where.AND = and;

  return where;
}

export function contactOrderBy(sort: ContactSort): Prisma.ContactOrderByWithRelationInput[] {
  if (sort === "name-desc") return [{ name: "desc" }, { id: "desc" }];
  if (sort === "updated") return [{ updatedAt: "desc" }, { name: "asc" }];
  if (sort === "created") return [{ createdAt: "desc" }, { name: "asc" }];
  return [{ name: "asc" }, { id: "asc" }];
}
