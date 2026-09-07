import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireQuoteStaff } from "@/lib/quotes/access";
import { parseContactIds } from "@/lib/quotes/kinds";
import { assessmentFromCrm, contactInfoFromCrm } from "@/lib/quotes/fromContacts";
import ProposalContactInfoDemo from "../builder/ProposalContactInfoDemo";

type SearchParams = Promise<{ contact?: string; contacts?: string; offer?: string }>;

export default async function NewQuotePage({ searchParams }: { searchParams: SearchParams }) {
  const { brand } = await requireQuoteStaff();
  const params = await searchParams;
  const offerId = typeof params.offer === "string" ? params.offer.trim() : "";
  const saved = offerId
    ? await prisma.quote.findFirst({
        where: { id: offerId, brandId: brand.id },
        select: { snapshotJson: true },
      })
    : null;
  const snapshot =
    saved?.snapshotJson && typeof saved.snapshotJson === "object"
      ? (saved.snapshotJson as {
          contactIds?: string[];
          contactInfo?: Record<string, unknown>;
          assessment?: Record<string, unknown>;
          isTestProposal?: boolean;
        })
      : {};
  const contactIds = parseContactIds(params.contacts ?? params.contact ?? snapshot.contactIds);

  const sourceContacts = contactIds.length
    ? await prisma.contact.findMany({
        where: { id: { in: contactIds }, brandId: brand.id },
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          phoneE164: true,
          phoneNumber: true,
          company: true,
          roleTitle: true,
        },
      })
    : [];

  const ordered = contactIds
    .map((id) => sourceContacts.find((contact) => contact.id === id))
    .filter((contact): contact is NonNullable<typeof contact> => Boolean(contact));

  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-400">Loading pricing generator…</div>}>
      <ProposalContactInfoDemo
        initialContactInfo={
          (snapshot.contactInfo as ReturnType<typeof contactInfoFromCrm>) ?? contactInfoFromCrm(ordered)
        }
        initialAssessment={
          {
            ...((snapshot.assessment as ReturnType<typeof assessmentFromCrm>) ?? assessmentFromCrm(ordered)),
            isTestProposal: snapshot.isTestProposal === true,
          }
        }
      />
    </Suspense>
  );
}
