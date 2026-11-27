import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildProposalCheckoutSummary } from "@/lib/engagements/proposalCheckout";
import { catalogCopyFromRows, toPublicBookkeepingProposal } from "@/lib/quotes/publicProposal";
import {
  PRIVATE_SENTINEL,
  sentinelBookkeepingSnapshot,
  sentinelCatalogRows,
} from "@/lib/quotes/publicProposalSentinel";

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  engagement: vi.fn(),
  brand: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/engagements/publicProposalAccess", () => ({
  hasPublicProposalAccess: mocks.access,
  publicProposalNotFound: () => Response.json({}, { status: 404 }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    engagement: { findUnique: mocks.engagement, updateMany: mocks.update },
    brand: { findUnique: mocks.brand },
  },
}));

import { GET } from "./route";

const checkout = buildProposalCheckoutSummary(
  toPublicBookkeepingProposal(
    sentinelBookkeepingSnapshot(),
    catalogCopyFromRows(sentinelCatalogRows),
  ),
  {
    tier: "improve",
    hasTwelveMonthAgreement: false,
    selectedCleanupPeriodKeys: [],
    selectedAdditionalOptionIds: [],
  },
);

function engagementRow() {
  return {
    brandId: "brand",
    productKind: "bookkeeping",
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    clientName: "Example LLC",
    primaryContactName: "Alex Example",
    primaryContactEmail: "alex@example.test",
    onboardingFee: 500,
    onboardingData: {
      proposalBuilderState: {
        assessment: {
          assessmentNotes: PRIVATE_SENTINEL,
          additionalOptions: [],
          bonuses: [],
        },
        services: {
          ...checkout,
          stripePaymentIntentId: PRIVATE_SENTINEL,
          secret: PRIVATE_SENTINEL,
        },
      },
    },
    agreementText: "Public agreement text",
    signedAt: null,
    signerName: null,
    signerTitle: null,
    onboardingFeeStatus: "REQUIRED",
    agreementManagerStatus: "ACTIVE",
    agreementCancellationRequestedAt: null,
    agreementCancellationReason: PRIVATE_SENTINEL,
    isTestProposal: false,
  };
}

const call = () => GET(
  new Request("https://firm.example.test/api/proposal/eng/agreement", {
    headers: { "x-proposal-token": "token", "x-hostname": "firm.example.test" },
  }),
  { params: Promise.resolve({ engagementId: "eng" }) },
);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.access.mockResolvedValue(true);
  mocks.engagement.mockResolvedValue(engagementRow());
  mocks.brand.mockResolvedValue({ name: "Southwest" });
  mocks.update.mockResolvedValue({ count: 1 });
});

describe("public proposal agreement API", () => {
  const accounts = [
    { id: "open", kind: "checking", label: "Checking", status: "open", monthlyTransactions: 120, basis: "measured" },
    { id: "closed", kind: "checking", label: "Closed checking", status: "closed", monthlyTransactions: 4000, basis: "estimated" },
  ];

  function rowWithAccounts(rawAccounts: unknown) {
    const row = engagementRow();
    return {
      ...row,
      agreementText: null,
      onboardingData: {
        ...row.onboardingData,
        proposalBuilderState: {
          ...row.onboardingData.proposalBuilderState,
          assessment: { ...row.onboardingData.proposalBuilderState.assessment, accounts: rawAccounts },
        },
      },
    };
  }

  it("renders normalized open-account volume, including a row with a repaired ID, and stores it for a new fixed-fee agreement", async () => {
    mocks.engagement.mockResolvedValue(rowWithAccounts([
      ...accounts,
      { id: "card", kind: "credit_card", status: "open", monthlyTransactions: "30.9", basis: "estimated" },
      { kind: "checking", monthlyTransactions: 9999 },
    ]));
    const response = await call();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.text).toContain("about 10,149 transactions per month across the accounts listed (partly estimated)");
    expect(body.text).toContain("Southwest will recheck");
    expect(body.text).toContain("13. Volume-Based Pricing");
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "eng", brandId: "brand", signedAt: null, updatedAt: engagementRow().updatedAt },
      data: { agreementText: body.text },
    });
  });

  it("ignores closed accounts for both volume and confidence", async () => {
    mocks.engagement.mockResolvedValue(rowWithAccounts(accounts));
    const body = await (await call()).json();
    expect(body.text).toContain("about 120 transactions per month across the accounts listed (measured)");
  });

  it.each([
    { rawAccounts: undefined }, { rawAccounts: [] }, { rawAccounts: [accounts[1]] },
  ])("uses generic wording when there is no open inventory ($rawAccounts)", async ({ rawAccounts }) => {
    mocks.engagement.mockResolvedValue(rowWithAccounts(rawAccounts));
    const body = await (await call()).json();
    expect(body.text).toContain("The monthly fee is based on the transaction volume across the accounts listed.");
    expect(body.text).not.toContain("about 0 transactions");
  });

  it("appends volume pricing when a saved custom template has no placeholder", async () => {
    const row = rowWithAccounts(accounts);
    mocks.engagement.mockResolvedValue({
      ...row,
      onboardingData: {
        proposalBuilderState: {
          ...row.onboardingData.proposalBuilderState,
          assessment: { ...row.onboardingData.proposalBuilderState.assessment, agreementTemplateContent: "Custom agreement for {{clientName}}" },
        },
      },
    });
    const body = await (await call()).json();
    expect(body.text).toContain("Custom agreement for Example LLC");
    expect(body.text).toContain("VOLUME-BASED PRICING");
    expect(body.text).toContain("about 120 transactions per month");
  });

  it("returns a signed agreement verbatim despite accounts now present in builder state", async () => {
    const storedText = "Signed legacy agreement\r\n  Preserve whitespace and {{volumeClause}} verbatim.\n";
    mocks.engagement.mockResolvedValue({
      ...rowWithAccounts(accounts),
      signedAt: new Date("2026-10-01T12:00:00Z"),
      agreementText: storedText,
    });
    const response = await call();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.text).toBe(storedText);
    expect(body.signed).toBe(true);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("does not rebuild a signed agreement even if its stored text is missing", async () => {
    mocks.engagement.mockResolvedValue({ ...rowWithAccounts(accounts), signedAt: new Date(), agreementText: null });
    const body = await (await call()).json();
    expect(body.text).toBe("");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it.each(["consulting", "coaching"])("does not add volume pricing when generating a missing %s agreement", async (productKind) => {
    mocks.engagement.mockResolvedValue({ ...rowWithAccounts(accounts), productKind });
    const body = await (await call()).json();
    expect(body.text).not.toMatch(/volume|pricing band/i);
    expect(body.text).toContain("18. Electronic Signature");
  });

  it.each(["consulting", "coaching"])("keeps the %s template stored by hourly publishing unchanged", async (productKind) => {
    const agreementText = "HOURLY SERVICES AGREEMENT\nTwo hours of consulting at $150 per hour.";
    mocks.engagement.mockResolvedValue({ ...rowWithAccounts(accounts), productKind, agreementText });
    const body = await (await call()).json();
    expect(body.text).toBe(agreementText);
    expect(body.text).not.toMatch(/volume|pricing band/i);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("keeps previously generated unsigned agreement text unchanged", async () => {
    mocks.engagement.mockResolvedValue({ ...rowWithAccounts(accounts), agreementText: "Previously generated agreement" });
    const body = await (await call()).json();
    expect(body.text).toBe("Previously generated agreement");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("GET agreement JSON omits assessment notes, cancellationReason, and raw checkout secrets", async () => {
    const response = await call();
    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(JSON.stringify(body)).not.toContain(PRIVATE_SENTINEL);
    expect(body).not.toHaveProperty("cancellationReason");
    expect(body.checkout).toEqual(expect.objectContaining({
      tier: "improve",
      amountDueNow: expect.any(Number),
    }));
    expect(body.checkout).not.toHaveProperty("stripePaymentIntentId");
    expect(body.text).toBe("Public agreement text");
  });
});
