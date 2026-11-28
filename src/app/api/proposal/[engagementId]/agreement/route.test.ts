import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  companyBundleFeeLines,
  DEFAULT_BUNDLE_PRICING_OPTIONS,
  hasCompanyBundle,
  normalizeCompanyBundle,
  priceCompanyBundle,
} from "@/lib/quotes/companyBundle";
import { effectiveAssessment } from "@/app/(app)/offers/builder/effectiveAssessment";
import type { AssessmentState } from "@/app/(app)/offers/builder/ProposalCreationWorkspaceDemo";
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
vi.mock("@/lib/prisma", () => {
  const tx = {
    quote: { findFirst: async () => ({ id: "quote" }) },
    engagement: { updateMany: mocks.update },
  };
  return {
    prisma: {
      engagement: { findUnique: mocks.engagement, updateMany: mocks.update },
      brand: { findUnique: mocks.brand },
      $transaction: (fn: (client: typeof tx) => unknown) => fn(tx),
    },
  };
});
// The quote row lock is covered by mutationLock tests; here it always passes.
vi.mock("@/lib/quotes/mutationLock", () => ({
  lockQuoteMutation: async () => ({ id: "quote" }),
  QuoteMutationConflictError: class QuoteMutationConflictError extends Error {},
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
      where: { id: "eng", brandId: "brand", signedAt: null, updatedAt: engagementRow().updatedAt,
        onboardingData: { equals: expect.any(Object) } },
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

  it("renders legacy agreements identically with companies absent or empty", async () => {
    const base = rowWithAccounts(accounts);
    const withCompanies = (companies: unknown) => ({
      ...base,
      onboardingData: {
        ...base.onboardingData,
        proposalBuilderState: {
          ...base.onboardingData.proposalBuilderState,
          assessment: { ...base.onboardingData.proposalBuilderState.assessment, numberOfEntities: 2, companies },
        },
      },
    });
    mocks.engagement.mockResolvedValue(withCompanies(undefined));
    const legacy = await (await call()).json();
    mocks.engagement.mockResolvedValue(withCompanies([]));
    const empty = await (await call()).json();
    expect(empty.text).toBe(legacy.text);
    expect(legacy.text).toContain("Ongoing Monthly Services:");
    expect(legacy.text).not.toMatch(/bundle/i);
  });

  it("lists one fee line per company with the bundle monthly total for a bundled assessment", async () => {
    const companies = [
      { id: "main", name: "Main Co", ownQboFile: true, fileStatus: "existing", locationsCount: 1, propertiesCount: 0, accounts: [], complexity: null },
      { id: "beta", name: "Beta LLC", ownQboFile: true, fileStatus: "new_file", locationsCount: 0, propertiesCount: 0, accounts: [], complexity: null },
    ];
    const base = rowWithAccounts(accounts);
    const storedAssessment = { ...base.onboardingData.proposalBuilderState.assessment, companies };
    expect(hasCompanyBundle(storedAssessment)).toBe(true);
    mocks.engagement.mockResolvedValue({
      ...base,
      onboardingData: {
        ...base.onboardingData,
        proposalBuilderState: { ...base.onboardingData.proposalBuilderState, assessment: storedAssessment },
      },
    });
    // The stored checkout selects Improve, so the bundle prices the improve tier.
    const priced = priceCompanyBundle({
      companies: normalizeCompanyBundle(companies),
      packageId: "improve",
      baseAssessment: effectiveAssessment(storedAssessment as unknown as AssessmentState),
      options: DEFAULT_BUNDLE_PRICING_OPTIONS,
    });
    const body = await (await call()).json();
    expect(body.text).toContain("Main Co — monthly bookkeeping:");
    expect(body.text).toContain("Beta LLC — monthly bookkeeping (bundle, 20% off):");
    expect(body.text).toContain("Beta LLC — new QuickBooks file setup: $150.00 (one-time)");
    expect(body.text).toContain("Locations — location reporting:");
    for (const line of companyBundleFeeLines(priced)) {
      expect(body.text).toContain(line.label);
    }
    expect(body.text).toContain(`Ongoing Monthly Services: $${priced.bundleMonthly.toFixed(2)} per month`);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "eng", brandId: "brand", signedAt: null, updatedAt: engagementRow().updatedAt },
      data: { agreementText: body.text },
    });
  });

  it("reads the selected tier from the snapshot bundle object", async () => {
    const companies = [
      { id: "main", name: "Main Co", ownQboFile: true, fileStatus: "existing", locationsCount: 0, propertiesCount: 0, accounts: [], complexity: null },
      { id: "beta", name: "Beta LLC", ownQboFile: true, fileStatus: "new_file", locationsCount: 0, propertiesCount: 0, accounts: [], complexity: null },
    ];
    const base = rowWithAccounts(accounts);
    const storedAssessment = { ...base.onboardingData.proposalBuilderState.assessment, companies };
    const priced = (packageId: "maintain" | "improve" | "grow") => priceCompanyBundle({
      companies: normalizeCompanyBundle(companies),
      packageId,
      baseAssessment: effectiveAssessment(storedAssessment as unknown as AssessmentState),
      options: DEFAULT_BUNDLE_PRICING_OPTIONS,
    });
    // Hand-adjusted improve tier: the route must read this object, not recompute it.
    const tamperedImprove = priced("improve");
    tamperedImprove.perCompany[1] = { ...tamperedImprove.perCompany[1], standaloneMonthly: 260, discountedMonthly: 210 };
    tamperedImprove.bundleMonthly = 550;
    const snapshotPricing = {
      maintain: { monthly: 450 },
      improve: { monthly: 550 },
      grow: { monthly: 675 },
      companyBundle: { maintain: priced("maintain"), improve: tamperedImprove, grow: priced("grow") },
    };
    mocks.engagement.mockResolvedValue({
      ...base,
      agreementText: null,
      onboardingData: {
        ...base.onboardingData,
        proposalBuilderState: { ...base.onboardingData.proposalBuilderState, assessment: storedAssessment },
      },
      quotes: [{
        publishedSnapshotJson: null,
        revisions: [{ snapshotJson: { assessment: storedAssessment, pricing: snapshotPricing } }],
      }],
    });
    const body = await (await call()).json();
    // Main prices $340 from the inventoried accounts; Beta reads the tampered
    // $210 object line (a recompute would print $200.00 instead).
    expect(body.text).toContain("Main Co — monthly bookkeeping: $340.00 per month");
    expect(body.text).toContain("Beta LLC — monthly bookkeeping (bundle, 20% off): $210.00");
    expect(body.text).toContain("Ongoing Monthly Services: $550.00 per month");
    expect(body.text).not.toContain("$200.00 per month");
  });

  it("does not rebuild a bundled signed agreement", async () => {
    const storedText = "Signed bundled agreement\r\n  Preserve whitespace verbatim.\n";
    mocks.engagement.mockResolvedValue({
      ...rowWithAccounts(accounts),
      signedAt: new Date("2026-10-01T12:00:00Z"),
      agreementText: storedText,
      onboardingData: {
        proposalBuilderState: {
          assessment: {
            accounts,
            companies: [
              { id: "main", name: "Main Co", ownQboFile: true, fileStatus: "existing", locationsCount: 0, propertiesCount: 0, accounts: [], complexity: null },
              { id: "beta", name: "Beta LLC", ownQboFile: true, fileStatus: "existing", locationsCount: 0, propertiesCount: 0, accounts: [], complexity: null },
            ],
          },
          services: {},
        },
      },
    });
    const body = await (await call()).json();
    expect(body.text).toBe(storedText);
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
