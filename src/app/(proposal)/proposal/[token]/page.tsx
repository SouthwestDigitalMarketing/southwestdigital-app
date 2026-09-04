import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { BrandRole } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSchemaCapabilities } from "@/lib/database/schemaCapabilities";
import { resolvePublicBrand } from "@/lib/brands/resolve";
import { getBrandAccessDecision } from "@/lib/brands/repository";
import OfferProposalPreview from "@/app/(app)/offers/builder/OfferProposalPreview";
import type { AssessmentState } from "@/app/(app)/offers/builder/ProposalCreationWorkspaceDemo";
import type { ContactInfoState } from "@/app/(app)/offers/builder/ProposalContactInfoState";
import { isLeadConvertedForDiscount, pickActiveCatalogOffer } from "@/lib/discounts/eligibility";
import { ensureQuoteEngagement } from "@/lib/engagements/fromOffer";
import { quoteContactSummaryFromSnapshot } from "@/lib/quotes/clientInfo";
import { HourlyPublicView } from "./HourlyPublicView";
import { isHourlyOfferKind, OFFER_KINDS } from "@/lib/quotes/kinds";
import { parseStoredHourlyCheckout } from "@/lib/engagements/hourlyCheckout";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export default async function PublicProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ staffPreview?: string }>;
}) {
  const { token } = await params;
  const { staffPreview } = await searchParams;
  const hostname = (await headers()).get("x-hostname");
  const brand = await resolvePublicBrand(hostname);
  if (!brand) notFound();
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
  const { quoteRevisions, quoteEngagement } = await getSchemaCapabilities();
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
    },
  });
  const viewedAt = new Date();
  if (quote && !quote.firstViewedAt && !isAuthorizedStaffPreview) {
    // Self-heal: a real client view is proof the URL made it out somehow,
    // so stamp firstSentAt (if not already) and flip status to "sent". This
    // keeps DB filters (Draft/Sent/Completed) consistent with the derived
    // lifecycle stage for out-of-band-shared URLs (personal email, text,
    // Slack, etc.).
    await prisma.quote.updateMany({
      where: { id: quote.id, firstViewedAt: null },
      data: {
        firstViewedAt: viewedAt,
        lastActivityAt: viewedAt,
        firstSentAt: quote.firstSentAt ?? viewedAt,
        sentAt: quote.sentAt ?? viewedAt,
        lastSentAt: quote.lastSentAt ?? viewedAt,
        ...(quote.status === "draft" ? { status: "sent" } : {}),
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
  if (quote && quoteEngagement && !engagementId) {
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

  if (engagement?.signedAt && (quote?.status === "completed" || quote?.status === "archived")) {
    redirect(`/proposal/${token}/receipt`);
  }

  const snapshotKind = typeof snapshot.kind === "string" ? snapshot.kind : "";
  if (isHourlyOfferKind(snapshotKind)) {
    const contact = quoteContactSummaryFromSnapshot(snapshot);
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
        proposalToken={token}
        engagementId={engagementId}
        isTestProposal={engagement?.isTestProposal === true}
        isStaffPreview={isAuthorizedStaffPreview}
        kindLabel={kindMeta?.name ?? snapshotKind}
        clientName={
          (isRecord(snapshot.contactInfo) && typeof (snapshot.contactInfo as Record<string, unknown>).companyName === "string")
            ? ((snapshot.contactInfo as Record<string, unknown>).companyName as string)
            : contact.name
        }
        brandName={brand.name}
        brandAccent={brand.theme?.accentColor ?? null}
        contact={{ name: contact.name, email: contact.email }}
        offer={{
          catalogItemLabel: hourlyCheckout.catalogItemLabel,
          quantity: hourlyCheckout.quantity,
          unitPrice: hourlyCheckout.unitPrice,
          intakeFee: hourlyCheckout.intakeFee,
          subtotal: hourlyCheckout.subtotal,
          total: hourlyCheckout.total,
          amountDueNow: hourlyCheckout.amountDueNow,
        }}
        agreementText={agreementText || "Agreement text unavailable. Please contact the sender."}
        alreadySigned={Boolean(engagement?.signedAt)}
      />
    );
  }

  return (
    <OfferProposalPreview
      initialAssessment={isRecord(snapshot.assessment) ? (snapshot.assessment as Partial<AssessmentState>) : undefined}
      initialContactInfo={isRecord(snapshot.contactInfo) ? (snapshot.contactInfo as Partial<ContactInfoState>) : undefined}
      live
      catalogOffer={catalogOffer}
      engagementId={engagementId}
      isTestProposal={engagement?.isTestProposal === true}
      isStaffPreview={isAuthorizedStaffPreview}
      proposalToken={token}
    />
  );
}
