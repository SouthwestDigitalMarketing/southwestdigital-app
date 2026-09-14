import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  brand: vi.fn(),
  quote: vi.fn(),
  engagement: vi.fn(),
  update: vi.fn(),
  brandRow: vi.fn(),
  catalog: vi.fn(),
  headersGet: vi.fn(),
  rateLimit: vi.fn(),
  pdf: vi.fn(),
  stripe: vi.fn(),
}));

vi.mock("@/lib/brands/resolve", () => ({ resolvePublicBrand: mocks.brand }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    quote: { findFirst: mocks.quote },
    engagement: { findUnique: mocks.engagement, updateMany: mocks.update, findFirst: mocks.engagement },
    brand: { findUnique: mocks.brandRow },
    catalogService: { findMany: mocks.catalog },
  },
}));
vi.mock("next/headers", () => ({
  headers: async () => ({ get: mocks.headersGet }),
}));
vi.mock("@/lib/simpleRateLimit", () => ({
  checkRateLimit: mocks.rateLimit,
}));
vi.mock("@/lib/agreements/signedPdf", () => ({
  createSignedProposalPdf: mocks.pdf,
}));
vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => mocks.stripe(),
}));
vi.mock("@/lib/stripe/connect", () => ({
  getChargeableConnectedAccountId: vi.fn(),
}));
vi.mock("@/lib/database/schemaCapabilities", () => ({
  getSchemaCapabilities: vi.fn(async () => ({})),
}));
vi.mock("@/lib/discounts/resolveOnboardingWaiver", () => ({
  resolveOnboardingWaiverForEngagement: vi.fn(),
}));
vi.mock("@/lib/quotes/mutationLock", () => ({
  lockQuoteMutation: vi.fn(),
  QuoteMutationConflictError: class extends Error {},
}));

import { POST as select } from "./[engagementId]/select/route";
import { POST as sign } from "./[engagementId]/sign/route";
import { POST as paymentIntent } from "./[engagementId]/payment-intent/route";
import { POST as confirmPayment } from "./[engagementId]/confirm-payment/route";
import { GET as agreement } from "./[engagementId]/agreement/route";
import { POST as cancel } from "./[engagementId]/cancel/route";
import { POST as paypalCreate } from "./[engagementId]/paypal/create-order/route";
import { POST as paypalCapture } from "./[engagementId]/paypal/capture-order/route";
import { GET as signedDocument } from "./[engagementId]/signed-document/route";

const params = { params: Promise.resolve({ engagementId: "engagement" }) };
const pdfParams = { params: Promise.resolve({ engagementId: "public-token" }) };

function quoteRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "quote",
    status: "sent",
    expiresAt: null,
    engagement: { brandId: "brand", signedAt: null as Date | null },
    ...overrides,
  };
}

function request(path: string, method: string) {
  return new Request(`https://firm.example.test${path}`, {
    method,
    headers: {
      "x-proposal-token": "public-token",
      "x-hostname": "firm.example.test",
      "content-type": "application/json",
    },
    body: method === "GET" ? undefined : "{}",
  });
}

const handlers = [
  { label: "POST select", run: () => select(request("/api/proposal/engagement/select", "POST"), params) },
  { label: "POST sign", run: () => sign(request("/api/proposal/engagement/sign", "POST"), params) },
  { label: "POST payment-intent", run: () => paymentIntent(request("/api/proposal/engagement/payment-intent", "POST"), params) },
  { label: "POST confirm-payment", run: () => confirmPayment(request("/api/proposal/engagement/confirm-payment", "POST"), params) },
  { label: "GET agreement", run: () => agreement(request("/api/proposal/engagement/agreement", "GET"), params) },
  { label: "POST cancel", run: () => cancel(request("/api/proposal/engagement/cancel", "POST"), params) },
  { label: "POST paypal/create-order", run: () => paypalCreate(request("/api/proposal/engagement/paypal/create-order", "POST"), params) },
  { label: "POST paypal/capture-order", run: () => paypalCapture(request("/api/proposal/engagement/paypal/capture-order", "POST"), params) },
  { label: "GET signed-document", run: () => signedDocument(request("/api/proposal/public-token/signed-document", "GET"), pdfParams) },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.brand.mockResolvedValue({ id: "brand", name: "Southwest" });
  mocks.quote.mockResolvedValue(quoteRow());
  mocks.engagement.mockResolvedValue({ onboardingFeeStatus: "INVOICED", signedAt: new Date(), agreementText: "text" });
  mocks.headersGet.mockReturnValue("firm.example.test");
  mocks.rateLimit.mockReturnValue({ allowed: true });
  mocks.pdf.mockResolvedValue(new Uint8Array([1]));
  mocks.stripe.mockImplementation(() => {
    throw new Error("Stripe must not be called");
  });
});

describe("public proposal API lifecycle", () => {
  it.each(handlers)("$label 404 for a suspended brand", async ({ run }) => {
    mocks.brand.mockResolvedValue(null);
    expect((await run()).status).toBe(404);
    expect(mocks.stripe).not.toHaveBeenCalled();
  });

  it.each(handlers)("$label 404 for a disabled domain", async ({ run }) => {
    mocks.brand.mockResolvedValue(null);
    expect((await run()).status).toBe(404);
    expect(mocks.stripe).not.toHaveBeenCalled();
  });

  it.each(handlers)("$label 404 for an expired quote", async ({ run, label }) => {
    mocks.quote.mockResolvedValue(quoteRow({ expiresAt: new Date(0) }));
    const status = (await run()).status;
    if (label === "POST confirm-payment" || label === "GET agreement" || label === "GET signed-document") {
      // Unsigned expired is denied for receipt-only and live-or-receipt surfaces.
      expect(status).toBe(404);
      return;
    }
    expect(status).toBe(404);
    expect(mocks.stripe).not.toHaveBeenCalled();
  });

  it.each(handlers)("$label 404 for a revoked token", async ({ run }) => {
    mocks.quote.mockResolvedValue(null);
    expect((await run()).status).toBe(404);
    expect(mocks.stripe).not.toHaveBeenCalled();
  });

  it("POST select 404 for an expired signed quote", async () => {
    mocks.quote.mockResolvedValue(quoteRow({
      expiresAt: new Date(0),
      engagement: { brandId: "brand", signedAt: new Date() },
    }));
    expect((await select(request("/api/proposal/engagement/select", "POST"), params)).status).toBe(404);
  });

  it("POST sign 404 for an expired signed quote", async () => {
    mocks.quote.mockResolvedValue(quoteRow({
      expiresAt: new Date(0),
      engagement: { brandId: "brand", signedAt: new Date() },
    }));
    expect((await sign(request("/api/proposal/engagement/sign", "POST"), params)).status).toBe(404);
  });

  it("POST payment-intent 404 for an expired signed quote and must not stay payable", async () => {
    mocks.quote.mockResolvedValue(quoteRow({
      expiresAt: new Date(0),
      engagement: { brandId: "brand", signedAt: new Date() },
    }));
    expect((await paymentIntent(request("/api/proposal/engagement/payment-intent", "POST"), params)).status).toBe(404);
    expect(mocks.stripe).not.toHaveBeenCalled();
  });

  it("POST payment-intent 404 for a live unsigned quote from pay", async () => {
    mocks.quote.mockResolvedValue(quoteRow());
    expect((await paymentIntent(request("/api/proposal/engagement/payment-intent", "POST"), params)).status).toBe(404);
    expect(mocks.stripe).not.toHaveBeenCalled();
  });

  it("POST paypal/create-order 404 for an expired signed quote before the 409 stub", async () => {
    mocks.quote.mockResolvedValue(quoteRow({
      expiresAt: new Date(0),
      engagement: { brandId: "brand", signedAt: new Date() },
    }));
    expect((await paypalCreate(request("/api/proposal/engagement/paypal/create-order", "POST"), params)).status).toBe(404);
  });

  it("POST paypal/capture-order 404 for an expired signed quote before the 409 stub", async () => {
    mocks.quote.mockResolvedValue(quoteRow({
      expiresAt: new Date(0),
      engagement: { brandId: "brand", signedAt: new Date() },
    }));
    expect((await paypalCapture(request("/api/proposal/engagement/paypal/capture-order", "POST"), params)).status).toBe(404);
  });

  it("POST confirm-payment allows an expired signed quote as receipt", async () => {
    mocks.quote.mockResolvedValue(quoteRow({
      expiresAt: new Date(0),
      engagement: { brandId: "brand", signedAt: new Date() },
    }));
    mocks.engagement.mockResolvedValue({ onboardingFeeStatus: "INVOICED" });
    expect((await confirmPayment(request("/api/proposal/engagement/confirm-payment", "POST"), params)).status).toBe(200);
  });

  it("GET agreement allows expired signed access through read/receipt", async () => {
    mocks.quote.mockResolvedValue(quoteRow({
      expiresAt: new Date(0),
      engagement: { brandId: "brand", signedAt: new Date() },
    }));
    mocks.engagement.mockResolvedValue({
      brandId: "brand",
      updatedAt: new Date(),
      clientName: "Alex",
      primaryContactName: "Alex",
      primaryContactEmail: "alex@example.test",
      onboardingFee: null,
      onboardingData: {},
      agreementText: "Agreement",
      signedAt: new Date(),
      signerName: "Alex",
      signerTitle: "Owner",
      onboardingFeeStatus: "PAID",
      agreementManagerStatus: "ACTIVE",
      agreementCancellationRequestedAt: null,
      isTestProposal: false,
    });
    mocks.brandRow.mockResolvedValue({ name: "Southwest" });
    expect((await agreement(request("/api/proposal/engagement/agreement", "GET"), params)).status).toBe(200);
  });

  it("POST cancel 404 for a revoked token", async () => {
    mocks.quote.mockResolvedValue(null);
    expect((await cancel(request("/api/proposal/engagement/cancel", "POST"), params)).status).toBe(404);
  });

  it("GET signed-document allows expired signed through access and 404 when unsigned", async () => {
    mocks.quote.mockResolvedValue({
      ...quoteRow({
        expiresAt: new Date(0),
        offerCode: "OFF-1",
      }),
      engagement: {
        brandId: "brand",
        signedAt: new Date(),
        agreementText: "Agreement",
        signerName: "Alex",
        clientName: "Alex",
        onboardingData: {},
        agreementTextHash: "hash",
        signerTitle: "Owner",
        billingContactEmail: "alex@example.test",
        signerIpAddress: null,
        signerUserAgent: null,
      },
    });
    expect((await signedDocument(request("/api/proposal/public-token/signed-document", "GET"), pdfParams)).status).toBe(200);

    mocks.quote.mockResolvedValue(quoteRow());
    expect((await signedDocument(request("/api/proposal/public-token/signed-document", "GET"), pdfParams)).status).toBe(404);
  });
});
