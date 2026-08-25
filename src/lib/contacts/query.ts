import "server-only";

import type { Prisma } from "@prisma/client";
import type { ContactSort } from "./tags";

export function contactSearchWhere(args: {
  brandId: string;
  q: string;
  status: "all" | "active" | "inactive";
  tagIds: string[];
  clientId?: string;
  relatedBrandId?: string;
}): Prisma.ContactWhereInput {
  const where: Prisma.ContactWhereInput = { brandId: args.brandId };

  if (args.status === "active") where.isActive = true;
  if (args.status === "inactive") where.isActive = false;

  if (args.q) {
    where.OR = [
      { name: { contains: args.q, mode: "insensitive" } },
      { email: { contains: args.q, mode: "insensitive" } },
      { secondaryEmail: { contains: args.q, mode: "insensitive" } },
      { company: { contains: args.q, mode: "insensitive" } },
      { roleTitle: { contains: args.q, mode: "insensitive" } },
      { phoneE164: { contains: args.q } },
    ];
  }

  if (args.tagIds.length > 0) {
    where.tagLinks = { some: { tagId: { in: args.tagIds } } };
  }

  if (args.clientId) {
    where.clientLinks = { some: { clientId: args.clientId } };
  }

  if (args.relatedBrandId) {
    where.brandLinks = { some: { relatedBrandId: args.relatedBrandId } };
  }

  return where;
}

export function contactOrderBy(sort: ContactSort): Prisma.ContactOrderByWithRelationInput[] {
  if (sort === "name-desc") return [{ name: "desc" }, { id: "desc" }];
  if (sort === "updated") return [{ updatedAt: "desc" }, { name: "asc" }];
  if (sort === "created") return [{ createdAt: "desc" }, { name: "asc" }];
  return [{ name: "asc" }, { id: "asc" }];
}
