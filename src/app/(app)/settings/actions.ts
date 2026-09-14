"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { IntegrationProvider, IntegrationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminBrandOrThrow } from "@/lib/brands/staff";
import { normalizePhone } from "@/lib/phone";
import { encryptSecret } from "@/lib/secrets/encryption";
import { parseGoogleReviewUrl, GOOGLE_REVIEW_INTEGRATION_KEY } from "@/lib/reviews/googleDestination";
import { QUO_INTEGRATION_KEY } from "@/lib/reviews/quoCredentials";
import {
  StripeConnectNotEnabledError,
  createBrandConnectOnboardingUrl,
  syncConnectedAccountStatus,
} from "@/lib/stripe/connect";
import { requestOrigin } from "@/lib/stripe/requestOrigin";
import { DEFAULT_TOOL_LINKS, parseToolUrl, type ToolLinkKey } from "@/lib/brands/tools";
import { normalizeBrandColor } from "@/lib/brands/colors";
import { BRAND_COLORS_CHOICE, normalizeThemeChoice } from "@/lib/brands/themePresets";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function updateBrandAppearanceAction(formData: FormData) {
  const { brand } = await requireAdminBrandOrThrow();
  const lightColor = normalizeBrandColor(clean(formData.get("lightColor")));
  const rawDark = clean(formData.get("darkColor"));
  const darkColor = rawDark ? normalizeBrandColor(rawDark) : null;
  const rawAccent = clean(formData.get("accentColor"));
  const accentColor = rawAccent ? normalizeBrandColor(rawAccent) : null;
  const accentForegroundColor = clean(formData.get("accentForegroundColor"));
  const mode = clean(formData.get("mode"));
  const sidebarLogoType = clean(formData.get("sidebarLogoType"));
  const rawThemePreset = clean(formData.get("themePreset"));
  const themePreset = rawThemePreset ? normalizeThemeChoice(rawThemePreset) : BRAND_COLORS_CHOICE;

  if (!lightColor) {
    throw new Error("Enter a HEX color or an RGB value, such as #17324d or rgb(23, 50, 77).");
  }
  if (rawDark && !darkColor) {
    throw new Error("Enter a valid HEX color for the Dark brand color.");
  }
  if (rawAccent && !accentColor) {
    throw new Error("Enter a valid HEX color for the Accent brand color.");
  }
  if (!["#ffffff", "#111827"].includes(accentForegroundColor)) {
    throw new Error("Choose white or black text for accent buttons.");
  }
  if (!new Set(["light", "dark"]).has(mode)) {
    throw new Error("Choose Light or Dark for the portal theme.");
  }
  if (!new Set(["mark", "logo"]).has(sidebarLogoType)) {
    throw new Error("Choose whether the sidebar shows the logo mark or full logo.");
  }

  await prisma.brandTheme.upsert({
    where: { brandId: brand.id },
    create: { brandId: brand.id, lightColor, darkColor, accentColor: accentColor ?? "#d79b3b", accentForegroundColor, mode, sidebarLogoType, themePreset },
    update: { lightColor, darkColor, accentColor: accentColor ?? undefined, accentForegroundColor, mode, sidebarLogoType, themePreset },
  });

  revalidatePath("/", "layout");
  revalidatePath("/settings");
}

export async function updateProposalMediaAction(formData: FormData) {
  const { brand } = await requireAdminBrandOrThrow();
  const proposalFeaturedVideoUrl = clean(formData.get("proposalFeaturedVideoUrl")) || null;
  const proposalFeaturedImageUrl = clean(formData.get("proposalFeaturedImageUrl")) || null;

  await prisma.brandTheme.upsert({
    where: { brandId: brand.id },
    create: { brandId: brand.id, lightColor: "#17324d", mode: "system", sidebarLogoType: "mark", proposalFeaturedVideoUrl, proposalFeaturedImageUrl },
    update: { proposalFeaturedVideoUrl, proposalFeaturedImageUrl },
  });

  revalidatePath("/", "layout");
  revalidatePath("/settings");
}

export async function updateToolLinksAction(formData: FormData) {
  const { brand } = await requireAdminBrandOrThrow();

  const updates = DEFAULT_TOOL_LINKS.map((fallback) => {
    const key = fallback.key;
    const label = clean(formData.get(`label-${key}`)) || fallback.label;
    if (label.length > 40) {
      throw new Error(`${fallback.label} label must be 40 characters or fewer.`);
    }
    const url = parseToolUrl(clean(formData.get(`url-${key}`))) ?? "";
    return { key, label, url, sortOrder: fallback.sortOrder };
  });

  await prisma.$transaction(
    updates.map((link) =>
      prisma.brandToolLink.upsert({
        where: { brandId_key: { brandId: brand.id, key: link.key } },
        create: {
          brandId: brand.id,
          key: link.key as ToolLinkKey,
          label: link.label,
          url: link.url,
          sortOrder: link.sortOrder,
        },
        update: {
          label: link.label,
          url: link.url,
          sortOrder: link.sortOrder,
        },
      }),
    ),
  );

  revalidatePath("/", "layout");
  revalidatePath("/settings");
}

export async function startStripeConnectOnboardingAction() {
  const { brand } = await requireAdminBrandOrThrow();
  const origin = requestOrigin(await headers());
  let url: string;
  try {
    url = await createBrandConnectOnboardingUrl({
      brandId: brand.id,
      brandName: brand.name,
      origin,
    });
  } catch (error) {
    if (error instanceof StripeConnectNotEnabledError) {
      redirect("/settings?stripe=connect-signup");
    }
    throw error;
  }
  redirect(url);
}

export async function refreshStripeConnectStatusAction() {
  const { brand } = await requireAdminBrandOrThrow();
  const integration = await prisma.brandIntegration.findUnique({
    where: { brandId_key: { brandId: brand.id, key: "stripe-connect" } },
    select: { externalAccountId: true },
  });
  if (integration?.externalAccountId) {
    await syncConnectedAccountStatus(integration.externalAccountId);
  }
  revalidatePath("/settings");
}

function normalizeFromNumber(raw: string) {
  try {
    return normalizePhone(raw);
  } catch {
    const compact = raw.replace(/[^\d+]/g, "");
    if (/^\+\d{8,15}$/.test(compact)) return compact;
    throw new Error("Enter the SMS from-number in E.164, like +15551234567.");
  }
}

export async function saveQuoIntegrationAction(formData: FormData) {
  const { brand } = await requireAdminBrandOrThrow();
  const fromNumber = normalizeFromNumber(clean(formData.get("fromNumber")));
  const phoneNumberId = clean(formData.get("phoneNumberId")) || null;
  const apiKey = clean(formData.get("apiKey"));

  const existing = await prisma.brandIntegration.findUnique({
    where: { brandId_key: { brandId: brand.id, key: QUO_INTEGRATION_KEY } },
    select: { secretCiphertext: true },
  });

  if (!apiKey && !existing?.secretCiphertext) {
    throw new Error("Enter the Quo API key for this brand.");
  }

  const secretCiphertext = apiKey ? encryptSecret(apiKey) : undefined;

  await prisma.brandIntegration.upsert({
    where: { brandId_key: { brandId: brand.id, key: QUO_INTEGRATION_KEY } },
    create: {
      brandId: brand.id,
      key: QUO_INTEGRATION_KEY,
      provider: IntegrationProvider.QUO,
      status: IntegrationStatus.ACTIVE,
      displayName: "Quo SMS",
      publicIdentifier: fromNumber,
      externalPropertyId: phoneNumberId,
      secretCiphertext: encryptSecret(apiKey),
      secretKeyVersion: 1,
      lastVerifiedAt: new Date(),
      lastErrorAt: null,
      lastErrorCode: null,
    },
    update: {
      provider: IntegrationProvider.QUO,
      status: IntegrationStatus.ACTIVE,
      displayName: "Quo SMS",
      publicIdentifier: fromNumber,
      externalPropertyId: phoneNumberId,
      ...(secretCiphertext
        ? { secretCiphertext, secretKeyVersion: 1, lastVerifiedAt: new Date() }
        : {}),
      lastErrorAt: null,
      lastErrorCode: null,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/reviews");
}

export async function disconnectQuoIntegrationAction() {
  const { brand } = await requireAdminBrandOrThrow();
  await prisma.brandIntegration.updateMany({
    where: { brandId: brand.id, key: QUO_INTEGRATION_KEY },
    data: {
      status: IntegrationStatus.DISCONNECTED,
      secretCiphertext: null,
      lastVerifiedAt: null,
      lastErrorAt: null,
      lastErrorCode: null,
    },
  });
  revalidatePath("/settings");
  revalidatePath("/reviews");
}

export async function saveGoogleReviewDestinationAction(formData: FormData) {
  const { brand } = await requireAdminBrandOrThrow();
  const raw = clean(formData.get("googleReviewUrl"));

  if (!raw) {
    await prisma.brandIntegration.updateMany({
      where: { brandId: brand.id, key: GOOGLE_REVIEW_INTEGRATION_KEY },
      data: {
        status: IntegrationStatus.DISCONNECTED,
        publicIdentifier: null,
      },
    });
    revalidatePath("/settings");
    revalidatePath("/reviews");
    return;
  }

  const url = parseGoogleReviewUrl(raw);

  await prisma.brandIntegration.upsert({
    where: { brandId_key: { brandId: brand.id, key: GOOGLE_REVIEW_INTEGRATION_KEY } },
    create: {
      brandId: brand.id,
      key: GOOGLE_REVIEW_INTEGRATION_KEY,
      provider: IntegrationProvider.OTHER,
      status: IntegrationStatus.ACTIVE,
      displayName: "Google review",
      publicIdentifier: url,
    },
    update: {
      provider: IntegrationProvider.OTHER,
      status: IntegrationStatus.ACTIVE,
      displayName: "Google review",
      publicIdentifier: url,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/reviews");
}
