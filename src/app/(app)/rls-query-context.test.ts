import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const dataContext = { brandId: "brand-42", actorUserId: "staff-7" };
  const transaction = {
    contact: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    leadContact: { findMany: vi.fn() },
  };
  const prisma = {
    contactTag: { findFirst: vi.fn(), findMany: vi.fn() },
    ticketClient: { findFirst: vi.fn() },
    brandDiscount: { findMany: vi.fn() },
    quote: { findMany: vi.fn() },
    pipeline: { findUnique: vi.fn() },
  };
  return {
    dataContext,
    transaction,
    prisma,
    staff: vi.fn(),
    staffOrThrow: vi.fn(),
    withBrandDataTransaction: vi.fn(),
    revalidate: vi.fn(),
    DiscountsCatalog: vi.fn(() => null),
    ClientEditor: vi.fn(() => null),
    LinkContactForm: vi.fn(() => null),
    PipelineBoard: vi.fn(() => null),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/brands/staff", () => ({
  requireStaffBrand: mocks.staff,
  requireStaffBrandOrThrow: mocks.staffOrThrow,
}));
vi.mock("@/lib/quotes/access", () => ({ requireQuoteStaffOrThrow: mocks.staffOrThrow }));
vi.mock("@/lib/tenancy/context", () => ({
  withBrandDataTransaction: mocks.withBrandDataTransaction,
}));
vi.mock("@/lib/contacts/automation", () => ({ applyTagPipelineAutomation: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("notFound"); },
  redirect: () => { throw new Error("redirect"); },
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("./discounts/DiscountsCatalog", () => ({ DiscountsCatalog: mocks.DiscountsCatalog }));
vi.mock("./clients/[id]/ClientEditor", () => ({ ClientEditor: mocks.ClientEditor }));
vi.mock("./clients/[id]/LinkContactForm", () => ({ LinkContactForm: mocks.LinkContactForm }));
vi.mock("./pipeline/[key]/PipelineBoard", () => ({ default: mocks.PipelineBoard }));
vi.mock("./pipeline/actions", () => ({ updateStageMultiplierAction: vi.fn() }));
vi.mock("next/link", () => ({ default: (props: { children: React.ReactNode }) => props.children }));

import { importContactsAction } from "./contacts/actions";
import ClientDetailPage from "./clients/[id]/page";
import DiscountsPage from "./discounts/page";
import { syncOfferContactsAction } from "./offers/who/actions";
import PipelineDetailPage from "./pipeline/[key]/page";

const authorized = {
  session: { user: { id: mocks.dataContext.actorUserId } },
  brand: { id: mocks.dataContext.brandId, name: "Test Brand" },
  dataContext: mocks.dataContext,
  isPlatformOperator: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.staff.mockResolvedValue(authorized);
  mocks.staffOrThrow.mockResolvedValue(authorized);
  mocks.withBrandDataTransaction.mockImplementation(
    (_context: unknown, operation: (transaction: typeof mocks.transaction) => unknown) =>
      operation(mocks.transaction),
  );
  mocks.transaction.contact.findFirst.mockResolvedValue(null);
  mocks.transaction.contact.findMany.mockResolvedValue([]);
  mocks.transaction.contact.create.mockResolvedValue({ id: "created-contact" });
  mocks.transaction.contact.update.mockResolvedValue({ id: "contact-1" });
  mocks.transaction.leadContact.findMany.mockResolvedValue([]);
  mocks.prisma.contactTag.findFirst.mockResolvedValue(null);
  mocks.prisma.contactTag.findMany.mockResolvedValue([]);
  mocks.prisma.brandDiscount.findMany.mockResolvedValue([]);
  mocks.prisma.quote.findMany.mockResolvedValue([]);
});

function elementOfType(node: React.ReactNode, type: unknown): React.ReactElement | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = elementOfType(child, type);
      if (found) return found;
    }
    return null;
  }
  if (!React.isValidElement(node)) return null;
  if (node.type === type) return node;
  return elementOfType((node.props as { children?: React.ReactNode }).children, type);
}

function expectAuthorizedContextCalls(count: number) {
  expect(mocks.withBrandDataTransaction).toHaveBeenCalledTimes(count);
  for (const [context] of mocks.withBrandDataTransaction.mock.calls) {
    expect(context).toEqual({ brandId: "brand-42", actorUserId: "staff-7" });
  }
}

describe("RLS context regressions", () => {
  it("skips imported duplicate contacts inside the authorized brand context", async () => {
    mocks.transaction.contact.findFirst.mockResolvedValueOnce({ id: "existing" });

    const result = await importContactsAction({ rows: [{ name: "Existing Person", email: "same@example.com" }] });

    expect(result).toEqual({ created: 0, skipped: 1, errors: [] });
    expectAuthorizedContextCalls(1);
    expect(mocks.transaction.contact.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        brandId: "brand-42",
        OR: [{ email: "same@example.com" }],
      },
    }));
    expect(mocks.transaction.contact.create).not.toHaveBeenCalled();
  });

  it("updates offer contacts only after a context-bound existence check", async () => {
    mocks.transaction.contact.findFirst.mockResolvedValueOnce({ id: "contact-1" });

    await syncOfferContactsAction({
      companyName: "Acme",
      people: [{
        contactId: "contact-1",
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        phone: "",
        roleTitle: "Owner",
      }],
    });

    expectAuthorizedContextCalls(2);
    expect(mocks.transaction.contact.findFirst).toHaveBeenCalledWith({
      where: { id: "contact-1", brandId: "brand-42" },
      select: { id: true },
    });
    expect(mocks.transaction.contact.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "contact-1" },
      data: expect.objectContaining({ name: "Ada Lovelace", email: "ada@example.com", company: "Acme" }),
    }));
  });

  it("keeps the discounts contact picker empty when the context-bound query returns no contacts", async () => {
    const page = await DiscountsPage();
    const picker = elementOfType(page, mocks.DiscountsCatalog);

    expectAuthorizedContextCalls(1);
    expect(picker).not.toBeNull();
    expect((picker!.props as { contacts: unknown[] }).contacts).toEqual([]);
    expect(mocks.transaction.contact.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { brandId: "brand-42", isActive: true },
    }));
  });

  it("loads linked client contacts by id in a separate brand-context query", async () => {
    mocks.prisma.ticketClient.findFirst.mockResolvedValue({
      id: "client-1", name: "Acme", code: "ACME", businessLegalName: null, entityType: null,
      authorizedCommunicationEmail: null, primaryContactPhone: null, isActive: true,
      contacts: [{ contactId: "contact-1" }],
    });
    mocks.transaction.contact.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "contact-1", name: "Ada Lovelace", email: "ada@example.com", roleTitle: "Owner", company: "Acme" }]);

    const page = await ClientDetailPage({ params: Promise.resolve({ id: "client-1" }) });
    const form = elementOfType(page, mocks.LinkContactForm);
    const query = mocks.prisma.ticketClient.findFirst.mock.calls[0][0];

    expectAuthorizedContextCalls(2);
    expect(query.select.contacts).toEqual({ orderBy: { createdAt: "desc" }, select: { contactId: true } });
    expect(query.select.contacts.select).not.toHaveProperty("contact");
    expect(mocks.transaction.contact.findMany).toHaveBeenLastCalledWith({
      where: { brandId: "brand-42", id: { in: ["contact-1"] } },
      select: { id: true, name: true, email: true, roleTitle: true, company: true },
    });
    expect((form!.props as { contacts: unknown[] }).contacts).toEqual([]);
  });

  it("loads pipeline LeadContact and Contact rows in one authorized transaction", async () => {
    mocks.prisma.pipeline.findUnique.mockResolvedValue({
      id: "pipeline-1", key: "leads", name: "Leads", description: null,
      stages: [{ id: "stage-1", key: "new", name: "New", description: null, sortOrder: 0, valueMultiplier: 1 }],
      items: [{
        id: "item-1", stageId: "stage-1", baseValueUsd: 100,
        stage: { id: "stage-1", valueMultiplier: 1 },
        lead: { id: "lead-1", name: "Acme", company: "Acme", email: null, clientId: null, kind: "LEAD", bookkeepingCategory: null, expectedServices: null, notes: null },
      }],
    });
    mocks.transaction.leadContact.findMany.mockResolvedValue([{ leadId: "lead-1", contactId: "contact-1" }]);
    mocks.transaction.contact.findMany.mockResolvedValue([{ id: "contact-1", name: "Ada Lovelace", phoneE164: "+15555550123" }]);

    const page = await PipelineDetailPage({ params: Promise.resolve({ key: "leads" }) });
    const board = elementOfType(page, mocks.PipelineBoard);

    expectAuthorizedContextCalls(1);
    expect(mocks.transaction.leadContact.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { brandId: "brand-42", leadId: { in: ["lead-1"] } },
    }));
    expect(mocks.transaction.contact.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { brandId: "brand-42", id: { in: ["contact-1"] } },
    }));
    expect((board!.props as { items: Array<{ contactId: string; contactName: string; leadPhone: string }> }).items[0]).toMatchObject({
      contactId: "contact-1", contactName: "Ada Lovelace", leadPhone: "+15555550123",
    });
  });
});
