import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { resolvePublicBrand } from "@/lib/brands/resolve";
import OfferProposalPreview from "@/app/(app)/offers/builder/OfferProposalPreview";
import type { AssessmentState } from "@/app/(app)/offers/builder/ProposalCreationWorkspaceDemo";
import type { ContactInfoState } from "@/app/(app)/offers/builder/ProposalContactInfoState";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export default async function PublicProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const hostname = (await headers()).get("x-hostname");
  const brand = await resolvePublicBrand(hostname);
  if (!brand) notFound();
  const quote = await prisma.quote.findFirst({
    where: { brandId: brand.id, publicToken: token, publishedAt: { not: null } },
    select: { publishedSnapshotJson: true },
  });
  const snapshot = isRecord(quote?.publishedSnapshotJson) ? quote.publishedSnapshotJson : null;
  if (!snapshot) notFound();

  return (
    <OfferProposalPreview
      initialAssessment={isRecord(snapshot.assessment) ? (snapshot.assessment as Partial<AssessmentState>) : undefined}
      initialContactInfo={isRecord(snapshot.contactInfo) ? (snapshot.contactInfo as Partial<ContactInfoState>) : undefined}
      live
    />
  );
}
