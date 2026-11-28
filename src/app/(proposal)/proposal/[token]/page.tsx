import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { hasInternalViewerCookie } from "@/lib/quotes/internalViewer";
import { BrandRole } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  catalogCopyFromRows,
  toPublicBookkeepingProposal,
  toPublicHourlyProposal,
} from "@/lib/quotes/publicProposal";
import { getSchemaCapabilities } from "@/lib/database/schemaCapabilities";
import { getBrandAccessDecision } from "@/lib/brands/repository";
import {
  findPublishedPublicQuote,
  quoteAllowsPublicCapability,
} from "@/lib/engagements/publicProposalAccess";
import OfferProposalPreview from "@/app/(app)/offers/builder/OfferProposalPreview";
import { isLeadConvertedForDiscount, pickActiveCatalogOffer } from "@/lib/discounts/eligibility";
import { ensureQuoteEngagement } from "@/lib/engagements/fromOffer";
import { isQuoteFrozen } from "@/lib/quotes/isQuoteFrozen";
import { resolveQuoteExpiresAtForWrite } from "@/lib/quotes/quoteExpiresAt";
import {
  expiredPublicNoticeKind,
  promoDeadlineFromSnapshot,
  replacedByQuoteIdFromSnapshot,
} from "@/lib/quotes/proposalValidity";
import { quoteContactSummaryFromSnapshot } from "@/lib/quotes/clientInfo";
import { HourlyPublicView } from "./HourlyPublicView";
import { isHourlyOfferKind, OFFER_KINDS } from "@/lib/quotes/kinds";
import { parseStoredHourlyCheckout } from "@/lib/engagements/hourlyCheckout";
import { isProposalPreviewSimulation } from "@/lib/quotes/previewSafety";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Notice for an unreadable public proposal. A superseded quote links to the
 * replacement's public link, but only when that replacement is published;
 * otherwise (and for plain expiry) the client sees the expired message.
 */
async function getExpiredProposalNotice(input: {
  brandId: string;
  quoteId: string;
  expired: boolean;
}) {
  const old = await prisma.quote.findFirst({
    where: { id: input.quoteId, brandId: input.brandId },
    select: { snapshotJson: true },
  });
  const replacedBy = replacedByQuoteIdFromSnapshot(old?.snapshotJson);
  if (replacedBy) {
    const next = await prisma.quote.findFirst({
      where: { id: replacedBy, brandId: input.brandId },
      select: { publicToken: true, publishedAt: true },
    });
    if (next?.publicToken && next.publishedAt) {
      return expiredPublicNoticeKind({ expired: input.expired, replacedByPublicToken: next.publicToken });
    }
    return expiredPublicNoticeKind({ expired: true, replacedByPublicToken: null });
  }
  return expiredPublicNoticeKind({ expired: input.expired, replacedByPublicToken: null });
}

function ExpiredProposalMessage({
  brandName,
  supportEmail,
  publicPath,
}: {
  brandName: string;
  supportEmail: string | null;
  publicPath: string | null;
}) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-slate-400">{brandName}</p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">
        {publicPath ? "Replaced by a newer proposal" : "This proposal has expired"}
      </h1>
      <p className="mt-3 text-base text-slate-600">
        {publicPath
          ? "This proposal was replaced by a newer one. The link below opens the current version."
          : "This proposal has expired. Contact us for an updated one."}
      </p>
      {publicPath ? (
        <a
          href={publicPath}
          className="mt-6 inline-block rounded-lg bg-slate-900 px-5 py-2.5 text-base font-medium text-white"
        >
          View the newer proposal
        </a>
      ) : supportEmail ? (
        <a
          href={`mailto:${supportEmail}`}
          className="mt-6 inline-block rounded-lg bg-slate-900 px-5 py-2.5 text-base font-medium text-white"
        >
          Contact {brandName}
        </a>
      ) : null}
    </main>
  );
}

export default async function PublicProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ staffPreview?: string; internal?: string }>;
}) {
  const { token } = await params;
  const { staffPreview, internal } = await searchParams;
  const requestHeaders = await headers();
  const hostname = requestHeaders.get("x-hostname");
  // Our own browsers (?internal=1 once, then a cookie) never count as a client view.
  const isInternalViewer = internal === "1" || hasInternalViewerCookie(requestHeaders.get("cookie"));
  const found = await findPublishedPublicQuote({ hostname, token });
  if (!found) notFound();
  const { brand } = found;
  const session = staffPreview === "1" ? await auth() : null;
  const staffPreviewAccess = session?.user
    ? await getBrandAccessDecision({
        brandId: brand.id,
        userId: session.user.id,
        userStatus: session.user.status,
        platformRole: session.user.platformRole,
        minimumRole: BrandRole.MEMBER,
      })
    : null;
  const isAuthorizedStaffPreview = staffPreviewAccess?.allowed === true;
  const isPreviewSimulation = isProposalPreviewSimulation({
    isStaffPreview: isAuthorizedStaffPreview,
  });
  const canRead = quoteAllowsPublicCapability(found.quote, "read");
  const canReceipt = quoteAllowsPublicCapability(found.quote, "receipt");
  if (!canRead && !isAuthorizedStaffPreview) {
    if (canReceipt) redirect(`/proposal/${encodeURIComponent(token)}/receipt`);
    const notice = await getExpiredProposalNotice({
      brandId: brand.id,
      quoteId: found.quote.id,
      expired: found.quote.expiresAt !== null && found.quote.expiresAt.getTime() <= new Date().getTime(),
    });
    if (notice) {
      return (
        <ExpiredProposalMessage
          brandName={brand.name}
          supportEmail={brand.theme?.supportEmail?.trim() || null}
          publicPath={notice.kind === "replaced" ? notice.publicPath : null}
        />
      );
    }
    notFound();
  }
  const { quoteRevisions, quoteEngagement, proposalCatalog, catalogProductKind } = await getSchemaCapabilities();
  const quote = await prisma.quote.findFirst({
    where: { brandId: brand.id, publicToken: token, publishedAt: { not: null } },
    select: {
      id: true,
      publishedSnapshotJson: true,
      publishedAt: true,
      firstViewedAt: true,
      firstSentAt: true,
      sentAt: true,
      lastSentAt: true,
      status: true,
      offerCode: true,
      engagementId: true,
      expiresAt: true,
      engagement: { select: { signedAt: true } },
    },
  });
  if (!quote) notFound();
  const viewedAt = new Date();
  // A completed (paid) quote keeps the origin/main stamps: a first view after
  // payment must not write first-view/send fields or flip status.
  if (canRead && quote && quote.status !== "completed" && !quote.firstViewedAt && !isAuthorizedStaffPreview && !isInternalViewer) {
    // Self-heal: a real client view is proof the URL made it out somehow,
    // so stamp firstSentAt (if not already) and flip status to "sent". This
    // keeps DB filters (Draft/Sent/Completed) consistent with the derived
    // lifecycle stage for out-of-band-shared URLs (personal email, text,
    // Slack, etc.). The default proposal expiry is stamped too (never for
    // frozen quotes).
    const selfHealExpiresAt =
      !quote.expiresAt && !isQuoteFrozen({ status: quote.status, engagement: quote.engagement })
        ? resolveQuoteExpiresAtForWrite({
            at: viewedAt,
            snapshot: quote.publishedSnapshotJson,
            promoDeadline: promoDeadlineFromSnapshot(quote.publishedSnapshotJson),
          })
        : null;
    await prisma.quote.updateMany({
      where: { id: quote.id, firstViewedAt: null },
      data: {
        firstViewedAt: viewedAt,
        lastActivityAt: viewedAt,
        firstSentAt: quote.firstSentAt ?? viewedAt,
        sentAt: quote.sentAt ?? viewedAt,
        lastSentAt: quote.lastSentAt ?? viewedAt,
        ...(quote.status === "draft" ? { status: "sent" } : {}),
        ...(selfHealExpiresAt ? { expiresAt: selfHealExpiresAt } : {}),
      },
    });
  }
  const firstViewedAt = quote?.firstViewedAt ?? (quote ? viewedAt : null);
  const revision = quote && quoteRevisions
    ? await prisma.quoteRevision.findFirst({
        where: { brandId: brand.id, quoteId: quote.id },
        orderBy: { version: "desc" },
        select: { snapshotJson: true },
      })
    : null;
  const revisionSnapshot = revision?.snapshotJson;
  const snapshot = isRecord(revisionSnapshot)
    ? revisionSnapshot
    : isRecord(quote?.publishedSnapshotJson)
      ? quote.publishedSnapshotJson
      : null;
  if (!snapshot) notFound();
  const isFreshDuplicate = snapshot.isFreshDuplicate === true;
  const suppressPromotions = isFreshDuplicate || snapshot.suppressPromotions === true;

  let engagementId = quoteEngagement ? quote?.engagementId ?? null : null;
  if (quote && quoteEngagement && !engagementId && !isPreviewSimulation) {
    try {
      engagementId = await ensureQuoteEngagement({
        brandId: brand.id,
        quoteId: quote.id,
        snapshot: {
          contactInfo: snapshot.contactInfo,
          assessment: snapshot.assessment,
          isTestProposal: snapshot.isTestProposal,
        },
      });
    } catch (error) {
      console.error("[proposal] Could not attach an engagement for signing and payment:", error);
    }
  }

  const primaryContactId = quoteContactSummaryFromSnapshot(snapshot).contactId;
  const quoteId = quote?.id ?? "";
  const [discounts, engagement] = await Promise.all([
    suppressPromotions
      ? Promise.resolve([])
      : prisma.brandDiscount.findMany({
          where: {
            brandId: brand.id,
            active: true,
            OR: [
              { contactId: null },
              ...(primaryContactId ? [{ contactId: primaryContactId }] : []),
              ...(quoteId ? [{ offerAssignments: { some: { quoteId, brandId: brand.id } } }] : []),
            ],
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        }),
    engagementId
      ? prisma.engagement.findFirst({
          where: { id: engagementId, brandId: brand.id },
          select: { status: true, isTestProposal: true, signedAt: true },
        })
      : Promise.resolve(null),
  ]);
  const catalogOffer = pickActiveCatalogOffer(
    discounts.map((discount) => ({
      kind: discount.kind,
      percent: discount.percent,
      amount: Number(discount.amount),
      title: discount.title,
      details: discount.details,
      activationMode: discount.activationMode,
      activationDelayDays: discount.activationDelayDays,
      deadlineMode: discount.deadlineMode,
      durationDays: discount.durationDays,
      deadlineDate: discount.deadlineDate,
      presentedAt: discount.presentedAt,
    })),
    {
      publishedAt: quote?.publishedAt ?? null,
      firstViewedAt,
      converted: isLeadConvertedForDiscount({
        quoteStatus: quote?.status,
        engagementStatus: engagement?.status,
      }),
    },
  );

  const snapshotKind = typeof snapshot.kind === "string" ? snapshot.kind : "";
  if (isHourlyOfferKind(snapshotKind)) {
    const kindMeta = OFFER_KINDS.find((k) => k.key === snapshotKind);
    // Prefer the checkout summary on the snapshot; fall back to the one stored
    // on the engagement's services blob.
    const snapshotCheckout = isRecord(snapshot.checkoutSummary)
      ? parseStoredHourlyCheckout(snapshot.checkoutSummary)
      : null;
    let hourlyCheckout = snapshotCheckout;
    let agreementText = typeof snapshot.agreementText === "string" ? (snapshot.agreementText as string) : "";
    if (engagementId) {
      const eng = await prisma.engagement.findFirst({
        where: { id: engagementId, brandId: brand.id },
        select: { onboardingData: true, agreementText: true },
      });
      if (eng?.agreementText) agreementText = eng.agreementText;
      if (!hourlyCheckout && eng?.onboardingData && typeof eng.onboardingData === "object" && !Array.isArray(eng.onboardingData)) {
        const state = (eng.onboardingData as Record<string, unknown>).proposalBuilderState;
        if (state && typeof state === "object" && !Array.isArray(state)) {
          const services = (state as Record<string, unknown>).services;
          if (services && typeof services === "object" && !Array.isArray(services)) {
            hourlyCheckout = parseStoredHourlyCheckout((services as Record<string, unknown>).hourlyCheckout);
          }
        }
      }
    }
    if (!hourlyCheckout) notFound();
    return (
      <HourlyPublicView
        {...toPublicHourlyProposal({
          snapshot,
          checkout: hourlyCheckout,
          brand: { name: brand.name, accent: brand.theme?.accentColor ?? null },
          agreementText: agreementText || "Agreement text unavailable. Please contact the sender.",
          flags: {
            proposalToken: token,
            engagementId: isPreviewSimulation ? null : engagementId,
            isTestProposal: engagement?.isTestProposal === true || snapshot.isTestProposal === true,
            isStaffPreview: isAuthorizedStaffPreview,
            alreadySigned: isPreviewSimulation ? false : Boolean(engagement?.signedAt),
            kindLabel: kindMeta?.name ?? snapshotKind,
          },
        })}
      />
    );
  }

  const catalogRows = proposalCatalog
    ? await prisma.catalogService.findMany({
        where: {
          brandId: brand.id,
          active: true,
          ...(catalogProductKind ? { productKind: "bookkeeping" } : {}),
        },
        select: {
          offerKey: true,
          code: true,
          name: true,
          clientBenefit: true,
          internalDescription: true,
        },
      })
    : [];
  const publicProposal = toPublicBookkeepingProposal(snapshot, catalogCopyFromRows(catalogRows));
  return (
    <OfferProposalPreview
      publicProposal={publicProposal}
      live
      catalogOffer={catalogOffer}
      engagementId={isPreviewSimulation ? null : engagementId}
      alreadySigned={isPreviewSimulation ? false : Boolean(engagement?.signedAt)}
      isTestProposal={engagement?.isTestProposal === true || snapshot.isTestProposal === true}
      isStaffPreview={isAuthorizedStaffPreview}
      proposalToken={token}
    />
  );
}
