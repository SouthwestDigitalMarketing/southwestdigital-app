import "server-only";
import { withBrandDataTransaction, type BrandDataContext } from "@/lib/tenancy/context";
import {
  createContactSchema,
  createCustomerAccountSchema,
  createLeadSchema,
} from "./schemas";

export async function listCustomerAccounts(context: BrandDataContext, search?: string) {
  const query = search?.trim();
  return withBrandDataTransaction(context, (transaction) =>
    transaction.customerAccount.findMany({
      where: {
        brandId: context.brandId,
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { legalName: { contains: query, mode: "insensitive" } },
                { code: { contains: query, mode: "insensitive" } },
                { communicationEmail: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: {
        contacts: {
          where: { isPrimary: true },
          include: { contact: true },
          take: 1,
        },
      },
      orderBy: [{ status: "asc" }, { name: "asc" }],
      take: 200,
    }),
  );
}

export async function createCustomerAccount(context: BrandDataContext, input: unknown) {
  const customer = createCustomerAccountSchema.parse(input);
  return withBrandDataTransaction(context, (transaction) =>
    transaction.customerAccount.create({
      data: { brandId: context.brandId, ...customer },
    }),
  );
}

export async function listContacts(context: BrandDataContext, search?: string) {
  const query = search?.trim();
  return withBrandDataTransaction(context, (transaction) =>
    transaction.contact.findMany({
      where: {
        brandId: context.brandId,
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { email: { contains: query.toLowerCase(), mode: "insensitive" } },
                { phoneNumber: { contains: query } },
              ],
            }
          : {}),
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      take: 200,
    }),
  );
}

export async function createContact(context: BrandDataContext, input: unknown) {
  const contact = createContactSchema.parse(input);
  return withBrandDataTransaction(context, (transaction) =>
    transaction.contact.create({
      data: {
        brandId: context.brandId,
        name: contact.displayName,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        secondaryEmail: contact.secondaryEmail,
        businessEmail: contact.businessEmail,
        personalEmail: contact.personalEmail,
        phoneE164: contact.phoneE164,
        phoneNumber: contact.phoneNumber,
        roleTitle: contact.roleTitle,
        isActive: contact.status !== "ARCHIVED",
      },
    }),
  );
}

export async function listLeads(context: BrandDataContext) {
  return withBrandDataTransaction(context, (transaction) =>
    transaction.lead.findMany({
      where: { brandId: context.brandId },
      include: {
        attributionTouches: {
          orderBy: { capturedAt: "asc" },
          take: 5,
        },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200,
    }),
  );
}

export async function createLead(context: BrandDataContext, input: unknown) {
  const leadInput = createLeadSchema.parse(input);
  const { attribution, estimatedValue, ...lead } = leadInput;

  return withBrandDataTransaction(context, async (transaction) => {
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
