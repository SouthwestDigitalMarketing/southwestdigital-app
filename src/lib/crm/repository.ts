import "server-only";
import { prisma } from "@/lib/prisma";
import type { BrandDataContext } from "@/lib/tenancy/context";
import {
  createContactSchema,
  createLeadSchema,
  type CreateContactInput,
  type CreateLeadInput,
} from "./schemas";

export async function listContacts(context: BrandDataContext, search?: string) {
  const query = search?.trim();
  return prisma.contact.findMany({
    where: {
      brandId: context.brandId,
      ...(query
        ? {
            OR: [
              { displayName: { contains: query, mode: "insensitive" } },
              { normalizedEmail: { contains: query.toLowerCase() } },
              { phoneNumber: { contains: query } },
            ],
          }
        : {}),
    },
    orderBy: [{ status: "asc" }, { displayName: "asc" }],
    take: 200,
  });
}

export async function createContact(context: BrandDataContext, input: CreateContactInput) {
  const contact = createContactSchema.parse(input);
  return prisma.contact.create({
    data: {
      brandId: context.brandId,
      ...contact,
      normalizedEmail: contact.email,
    },
  });
}

export async function listLeads(context: BrandDataContext) {
  return prisma.lead.findMany({
    where: { brandId: context.brandId },
    include: {
      attributionTouches: {
        orderBy: { capturedAt: "asc" },
        take: 5,
      },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
}

export async function createLead(context: BrandDataContext, input: CreateLeadInput) {
  const leadInput = createLeadSchema.parse(input);
  const { attribution, estimatedValue, ...lead } = leadInput;

  return prisma.$transaction(async (transaction) => {
    const createdLead = await transaction.lead.create({
      data: {
        brandId: context.brandId,
        ...lead,
        normalizedEmail: lead.email,
        estimatedValue,
      },
    });

    if (attribution) {
      await transaction.leadAttributionTouch.create({
        data: {
          brandId: context.brandId,
          leadId: createdLead.id,
          ...attribution,
        },
      });
    }

    return createdLead;
  });
}

