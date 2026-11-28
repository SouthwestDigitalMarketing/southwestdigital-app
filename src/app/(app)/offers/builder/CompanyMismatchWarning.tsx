"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { compareCompanyNames } from "@/lib/quotes/companyMatch";
import {
  CONTACT_INFO_STORAGE_KEY,
  readProposalBuilderLocalState,
  subscribeToProposalBuilderState,
} from "./ProposalBuilderStorage";
import {
  formatPersonName,
  type ContactInfoState,
} from "./ProposalContactInfoState";
import { searchOfferContactsAction } from "../who/actions";

export type CompanyMismatchWarningProps = {
  /** Offer id, used to deep-link the relink control on the offers list. */
  offerId: string;
  /** Linked contact's company (CRM Contact.company). */
  contactCompany: string | null | undefined;
  /** Proposal company (snapshot contactInfo.companyName, fallback QuoteClient.company). */
  proposalCompany: string | null | undefined;
  /**
   * Accepted/signed/paid quotes are frozen: show the warning without a relink
   * action. Defaults to false (relink available on unaccepted quotes).
   */
  frozen?: boolean;
};

/**
 * Staff-only wrong-company warning (Spec 08/C). Mounted only in the staff
 * proposal builder, which is itself staff-gated; the contact lookup action
 * used by the wrapper below also requires staff.
 *
 * Renders nothing unless the two companies compare as a mismatch (either
 * side empty is "unknown", never a warning).
 */
export function CompanyMismatchWarning({
  offerId,
  contactCompany,
  proposalCompany,
  frozen = false,
}: CompanyMismatchWarningProps) {
  if (compareCompanyNames(contactCompany, proposalCompany) !== "mismatch") return null;
  const contact = (contactCompany ?? "").trim();
  const proposal = (proposalCompany ?? "").trim();
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-amber-800"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 text-sm">
        <p>
          The linked contact&apos;s company ({contact}) differs from this
          proposal&apos;s company ({proposal}).
        </p>
        {frozen ? null : (
          <Link
            href={`/offers?highlight=${encodeURIComponent(offerId)}`}
            title="Open this offer in the offers list to change its linked contact."
            className="mt-1 inline-block font-semibold underline hover:text-amber-900"
          >
            Relink the contact
          </Link>
        )}
      </div>
    </div>
  );
}

function linkedCrmContact(contactInfo: ContactInfoState | undefined): {
  id: string;
  query: string;
} | null {
  if (!contactInfo) return null;
  // Only a CRM-linked owner carries a company to compare against; a custom
  // (non-owner) primary contact has no linked CRM record.
  const owner =
    contactInfo.owners.find((candidate) => candidate.id === contactInfo.primaryContact.ownerId) ?? null;
  const source = contactInfo.primaryContact.sameAsOwner ? owner : null;
  if (!source?.crmContactId) return null;
  const name = formatPersonName(source.firstName, source.lastName);
  return { id: source.crmContactId, query: source.email.trim() || name };
}

/**
 * Self-loading mount for the finalize step: compares the live draft proposal
 * company (builder localStorage) against the linked CRM contact's company
 * (resolved through the existing staff-only contact search) and renders the
 * warning on mismatch.
 */
export default function CompanyMismatchWarningForOffer({ offerId }: { offerId: string | null }) {
  const [proposalCompany, setProposalCompany] = useState<string | null>(null);
  const [contactCompany, setContactCompany] = useState<string | null>(null);

  useEffect(() => {
    if (!offerId) return;
    let disposed = false;

    async function resolveContactCompany(contactInfo: ContactInfoState | undefined) {
      const linked = linkedCrmContact(contactInfo);
      if (!linked) {
        if (!disposed) setContactCompany(null);
        return;
      }
      try {
        const results = await searchOfferContactsAction(linked.query);
        const match = results.find((contact) => contact.id === linked.id) ?? null;
        if (!disposed) setContactCompany(match?.company ?? null);
      } catch {
        // A failed lookup is "unknown", never a warning.
        if (!disposed) setContactCompany(null);
      }
    }

    function refresh() {
      const contactInfo = readProposalBuilderLocalState().contactInfo as ContactInfoState | undefined;
      // Intentional client-only hydration after the SSR-safe null first render.
      setProposalCompany(contactInfo?.companyName ?? null);
      void resolveContactCompany(contactInfo);
    }

    refresh();
    // Only contact-info writes can change either side of this comparison.
    const unsubscribe = subscribeToProposalBuilderState((changedKey) => {
      if (changedKey !== undefined && !changedKey.startsWith(CONTACT_INFO_STORAGE_KEY)) return;
      refresh();
    });
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [offerId]);

  if (!offerId) return null;
  // Mirror the child's render gate so the mount adds no layout (mt-4) when
  // there is nothing to warn about. Freeze state is not visible client-side;
  // the relink target (offers-list OfferContactCell -> reassignQuoteContactAction)
  // refuses frozen quotes server-side via assertQuoteNotFrozen, so a relink
  // attempt on a frozen quote fails safely instead of mutating it.
  if (compareCompanyNames(contactCompany, proposalCompany) !== "mismatch") return null;
  return (
    <div className="mt-4">
      <CompanyMismatchWarning
        offerId={offerId}
        contactCompany={contactCompany}
        proposalCompany={proposalCompany}
      />
    </div>
  );
}
