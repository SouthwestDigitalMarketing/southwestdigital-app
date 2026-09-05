import { IntegrationStatus } from "@prisma/client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canAdministerBrand, requireStaffBrand } from "@/lib/brands/staff";
import { mergeToolLinks } from "@/lib/brands/tools";
import {
  STRIPE_CONNECT_KEY,
  StripeConnectNotEnabledError,
  createBrandConnectOnboardingUrl,
  syncConnectedAccountStatus,
} from "@/lib/stripe/connect";
import { requestOrigin } from "@/lib/stripe/requestOrigin";
import { ToolLinksForm } from "./ToolLinksForm";
import { BrandAppearanceForm } from "./BrandAppearanceForm";
import { StripeConnectForm } from "./StripeConnectForm";
import { YouTubeIntegrationForm } from "./YouTubeIntegrationForm";
import { EmailConnectionsPanel } from "./EmailConnectionsPanel";
import { getMembershipEmailConnection, toPublicConnection } from "@/lib/emailConnections/repository";

type EmailNotice = "connected" | "cancelled" | "error" | "missing-refresh-token" | "not-configured" | "access-denied";

const EMAIL_NOTICES: readonly EmailNotice[] = [
  "connected",
  "cancelled",
  "error",
  "missing-refresh-token",
  "not-configured",
  "access-denied",
];

function parseEmailNotice(value: string | undefined): EmailNotice | null {
  return value && (EMAIL_NOTICES as readonly string[]).includes(value) ? (value as EmailNotice) : null;
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ stripe?: string; youtube?: string; reason?: string; email?: string }>;
}) {
  const context = await requireStaffBrand();
  const { brand, membership } = context;
  const query = await searchParams;
  const emailConnectionRow = membership ? await getMembershipEmailConnection(membership.id) : null;
  const emailConnection = emailConnectionRow ? toPublicConnection(emailConnectionRow) : null;
  const zohoConfigured = Boolean(process.env.ZOHO_MAIL_CLIENT_ID?.trim() && process.env.ZOHO_MAIL_CLIENT_SECRET?.trim());
  const emailNotice = parseEmailNotice(query.email);
  if (!canAdministerBrand(context)) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your settings</h1>
          <p className="mt-2 text-sm text-muted-foreground">Manage your mailbox. Shared firm settings are managed by your brand administrator.</p>
        </div>
        <EmailConnectionsPanel connection={emailConnection} zohoConfigured={zohoConfigured} notice={emailNotice} />
      </div>
    );
  }
  if (query.stripe === "refresh") {
    let url: string;
    try {
      url = await createBrandConnectOnboardingUrl({
        brandId: brand.id,
        brandName: brand.name,
        origin: requestOrigin(await headers()),
      });
    } catch (error) {
      if (error instanceof StripeConnectNotEnabledError) {
        redirect("/settings?stripe=connect-signup");
      }
      throw error;
    }
    redirect(url);
  }

  const stored = await prisma.brandToolLink.findMany({
    where: { brandId: brand.id },
    select: { key: true, label: true, url: true, sortOrder: true },
    orderBy: { sortOrder: "asc" },
  });
  let connect = await prisma.brandIntegration.findUnique({
    where: { brandId_key: { brandId: brand.id, key: STRIPE_CONNECT_KEY } },
    select: { status: true, externalAccountId: true },
  });
  const youtube = await prisma.brandIntegration.findUnique({
    where: { brandId_key: { brandId: brand.id, key: "youtube" } },
    select: { status: true, externalAccountId: true, publicIdentifier: true },
  });
  if ((query.stripe === "return" || query.stripe === "refresh") && connect?.externalAccountId) {
    await syncConnectedAccountStatus(connect.externalAccountId);
    connect = await prisma.brandIntegration.findUnique({
      where: { brandId_key: { brandId: brand.id, key: STRIPE_CONNECT_KEY } },
      select: { status: true, externalAccountId: true },
    });
  }
  const connectStatus =
    connect?.status === IntegrationStatus.ACTIVE
      ? "active"
      : connect?.status === IntegrationStatus.ERROR
        ? "error"
        : connect
          ? "pending"
          : "missing";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">Connections, appearance, and shared tools for {brand.name}.</p>
      </div>
      <div className="grid gap-4">
        <StripeConnectForm
          status={connectStatus}
          accountId={connect?.externalAccountId ?? null}
          notice={
            query.stripe === "connect-signup"
              ? "connect-signup"
              : query.stripe === "return" || query.stripe === "refresh"
                ? "return"
                : null
          }
        />
        <EmailConnectionsPanel
          connection={emailConnection}
          zohoConfigured={zohoConfigured}
          notice={emailNotice}
        />
        <YouTubeIntegrationForm
          status={youtube?.status === IntegrationStatus.ACTIVE ? "active" : youtube?.status === IntegrationStatus.ERROR ? "error" : "missing"}
          channelName={youtube?.publicIdentifier ?? null}
          channelId={youtube?.externalAccountId ?? null}
          notice={query.youtube}
          reason={query.reason ?? null}
        />
        <BrandAppearanceForm
          theme={{
            lightColor: brand.theme?.lightColor ?? "#17324d",
            darkColor: brand.theme?.darkColor ?? null,
            accentColor: brand.theme?.accentColor ?? "#d79b3b",
            accentForegroundColor: brand.theme?.accentForegroundColor ?? "#ffffff",
            mode: brand.theme?.mode ?? "system",
            logoUrl: brand.theme?.logoUrl ?? null,
            logoMarkUrl: brand.theme?.logoMarkUrl ?? null,
            logoDarkUrl: brand.theme?.logoDarkUrl ?? null,
            logoMarkDarkUrl: brand.theme?.logoMarkDarkUrl ?? null,
            sidebarLogoType: brand.theme?.sidebarLogoType ?? "mark",
            themePreset: brand.theme?.themePreset ?? "brand-colors",
          }}
        />
        <ToolLinksForm links={mergeToolLinks(stored)} />
      </div>
    </div>
  );
}
