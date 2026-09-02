import "server-only";

import { IntegrationProvider, IntegrationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";

export const STRIPE_CONNECT_KEY = "stripe-connect";

export class StripeConnectNotEnabledError extends Error {
  constructor() {
    super(
      "Stripe Connect is not enabled on the platform account yet. Open https://dashboard.stripe.com/test/connect, complete Connect signup in Test mode, then try again.",
    );
    this.name = "StripeConnectNotEnabledError";
  }
}

function isConnectSignupError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /signed up for Connect/i.test(message);
}

export async function getBrandStripeConnect(brandId: string) {
  return prisma.brandIntegration.findUnique({
    where: { brandId_key: { brandId, key: STRIPE_CONNECT_KEY } },
    select: {
      id: true,
      status: true,
      externalAccountId: true,
      lastErrorCode: true,
      lastVerifiedAt: true,
    },
  });
}

export async function getChargeableConnectedAccountId(brandId: string) {
  const integration = await getBrandStripeConnect(brandId);
  if (!integration?.externalAccountId || integration.status !== IntegrationStatus.ACTIVE) return null;
  return integration.externalAccountId;
}

async function upsertConnectIntegration(
  brandId: string,
  data: {
    externalAccountId: string;
    status: IntegrationStatus;
    lastErrorCode?: string | null;
  },
) {
  return prisma.brandIntegration.upsert({
    where: { brandId_key: { brandId, key: STRIPE_CONNECT_KEY } },
    create: {
      brandId,
      key: STRIPE_CONNECT_KEY,
      provider: IntegrationProvider.STRIPE,
      status: data.status,
      displayName: "Stripe Connect",
      externalAccountId: data.externalAccountId,
      lastErrorCode: data.lastErrorCode ?? null,
      lastVerifiedAt: data.status === IntegrationStatus.ACTIVE ? new Date() : null,
    },
    update: {
      provider: IntegrationProvider.STRIPE,
      status: data.status,
      displayName: "Stripe Connect",
      externalAccountId: data.externalAccountId,
      lastErrorCode: data.lastErrorCode ?? null,
      lastVerifiedAt: data.status === IntegrationStatus.ACTIVE ? new Date() : null,
      lastErrorAt: data.status === IntegrationStatus.ERROR ? new Date() : null,
    },
  });
}

export function connectStatusFromAccount(account: {
  charges_enabled?: boolean | null;
  payouts_enabled?: boolean | null;
  details_submitted?: boolean | null;
}) {
  if (account.charges_enabled && account.payouts_enabled) return IntegrationStatus.ACTIVE;
  return IntegrationStatus.PENDING;
}

export async function syncConnectedAccountStatus(accountId: string) {
  const stripe = getStripeClient();
  const account = await stripe.accounts.retrieve(accountId);
  const integration = await prisma.brandIntegration.findFirst({
    where: { key: STRIPE_CONNECT_KEY, externalAccountId: accountId },
    select: { brandId: true },
  });
  if (!integration) return account;
  await upsertConnectIntegration(integration.brandId, {
    externalAccountId: account.id,
    status: connectStatusFromAccount(account),
  });
  return account;
}

export async function createBrandConnectOnboardingUrl(input: {
  brandId: string;
  brandName: string;
  origin: string;
}) {
  const stripe = getStripeClient();
  const existing = await getBrandStripeConnect(input.brandId);
  let accountId = existing?.externalAccountId ?? null;

  try {
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "US",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: { name: input.brandName },
        metadata: { brandId: input.brandId },
      });
      accountId = account.id;
      await upsertConnectIntegration(input.brandId, {
        externalAccountId: accountId,
        status: IntegrationStatus.PENDING,
      });
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${input.origin}/settings?stripe=refresh`,
      return_url: `${input.origin}/settings?stripe=return`,
      type: "account_onboarding",
    });
    return link.url;
  } catch (error) {
    if (isConnectSignupError(error)) throw new StripeConnectNotEnabledError();
    throw error;
  }
}
