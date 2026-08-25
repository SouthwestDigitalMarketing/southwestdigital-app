import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireQuoteStaff } from "@/lib/quotes/access";
import ProposalContactInfoDemo from "../builder/ProposalContactInfoDemo";
import type { ContactInfoState } from "../builder/ProposalContactInfoState";
import type { AssessmentState } from "../builder/ProposalCreationWorkspaceDemo";

type SearchParams = Promise<{ contact?: string }>;

function splitContactName(value: string | null | undefined) {
  const parts = (value ?? "")
    .replace(/^(mr|mrs|ms|dr)\.?\s+/i, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

export default async function NewQuotePage({ searchParams }: { searchParams: SearchParams }) {
  const { brand } = await requireQuoteStaff();
  const params = await searchParams;
  const contactId = typeof params.contact === "string" ? params.contact.trim() : "";

  const sourceContact = contactId
    ? await prisma.contact.findFirst({
        where: { id: contactId, brandId: brand.id },
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          phoneE164: true,
          phoneNumber: true,
          company: true,
        },
      })
    : null;

  const name = sourceContact
    ? {
        firstName: sourceContact.firstName?.trim() || splitContactName(sourceContact.name).firstName,
        lastName: sourceContact.lastName?.trim() || splitContactName(sourceContact.name).lastName,
      }
    : null;

  const initialContactInfo: Partial<ContactInfoState> | undefined = sourceContact
    ? {
        companyName: sourceContact.company ?? "",
        invoicingEmail: sourceContact.email ?? "",
        invoicingOwnerId: "owner-1",
        owners: [
          {
            id: "owner-1",
            firstName: name?.firstName ?? "",
            lastName: name?.lastName ?? "",
            email: sourceContact.email ?? "",
            phone: sourceContact.phoneE164 || sourceContact.phoneNumber || "",
            ownershipPercentage: "100",
          },
        ],
        primaryContact: {
          sameAsOwner: true,
          ownerId: "owner-1",
          firstName: name?.firstName ?? "",
          lastName: name?.lastName ?? "",
          email: sourceContact.email ?? "",
          phone: sourceContact.phoneE164 || sourceContact.phoneNumber || "",
          role: "Owner / Founder",
        },
      }
    : undefined;

  const initialAssessment: Partial<AssessmentState> | undefined = sourceContact
    ? {
        clientName: sourceContact.name,
        contactEmail: sourceContact.email ?? "",
        contactPhone: sourceContact.phoneE164 || sourceContact.phoneNumber || "",
        contactRole: "Owner / Founder",
        companyName: sourceContact.company ?? "",
      }
    : undefined;

  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-400">Loading pricing generator…</div>}>
      <ProposalContactInfoDemo
        initialContactInfo={initialContactInfo}
        initialAssessment={initialAssessment}
      />
    </Suspense>
  );
}
