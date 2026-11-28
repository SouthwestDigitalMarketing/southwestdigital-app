"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Save, Send, Upload } from "lucide-react";
import ProposalAppDemoHeader from "./ProposalAppDemoHeader";
import CompanyMismatchWarningForOffer from "./CompanyMismatchWarning";
import PricingSnapshotSidebar from "./PricingSnapshotSidebar";
import { readProposalBuilderLocalState } from "./ProposalBuilderStorage";
import {
  formatPersonName,
  resolvePrimaryContact,
  useProposalContactInfoDemoState,
  type ContactInfoState,
} from "./ProposalContactInfoState";
import { useBrand } from "@/lib/brands/context";
import {
  getProposalPricingSnapshotCleanupCard,
  getProposalPricingSnapshotPricing,
  getProposalPricingSnapshotItems,
  useProposalAssessmentDemoState,
  type AssessmentState,
} from "./ProposalCreationWorkspaceDemo";
import {
  getOfferKindAction,
  getOfferPromiseConfirmationsAction,
  getOfferPublicPathAction,
  publishOfferChangesAction,
  saveOfferDraftAction,
  syncOfferContactsAction,
} from "../who/actions";
import {
  effectiveCoverBodies,
  normalizeCoverTextForScan,
} from "./coverLetterState";
import {
  collectPromiseFieldsFromAssessment,
  scanPromiseRisks,
  unresolvedPromiseHits,
  type PromiseConfirmation,
  type PromiseHit,
} from "@/lib/quotes/promiseCheck";

function editHrefForHit(where: string, query: string) {
  const step = where === "Cover email" || where === "Cover SMS"
    ? "/offers/cover"
    : where.startsWith("Intro")
      ? "/offers/intro"
      : where.startsWith("Bonus:") || where.startsWith("Additional option:")
        || where.startsWith("Bonus name:") || where.startsWith("Additional option name:")
        || where.startsWith("Package name:")
        ? "/offers/add-ons"
        // "First payment credit reason" is edited beside pricing, so the
        // adjustments fallback covers it.
        : "/offers/adjustments";
  return withQuery(step, query);
}

function withQuery(href: string, query: string) {
  if (!query) return href;
  return `${href}${href.includes("?") ? "&" : "?"}${query}`;
}

export default function ProposalFinalizeDemo() {
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const offerId = searchParams.get("offer");
  const { assessment } = useProposalAssessmentDemoState();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">(offerId ? "saved" : "idle");
  const [publishStatus, setPublishStatus] = useState<"idle" | "publishing" | "published" | "error">("idle");
  const [publishedVersion, setPublishedVersion] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const { brand } = useBrand();
  const { contactInfo } = useProposalContactInfoDemoState();
  const [publicPath, setPublicPath] = useState("");
  const [offerKind, setOfferKind] = useState<string | null>(null);
  const [promiseConfirmations, setPromiseConfirmations] = useState<PromiseConfirmation[]>([]);
  const [confirmingHit, setConfirmingHit] = useState<string | null>(null);

  useEffect(() => {
    if (!offerId) return;
    void getOfferPublicPathAction(offerId).then((publicPath) => {
      if (publicPath) {
        setSaveStatus("saved");
        setPublishStatus("published");
      }
      setPublicPath(publicPath ?? "");
    });
    void getOfferKindAction(offerId).then((kind) => setOfferKind(kind));
    // Hydrate stored "Keep this wording" confirmations so a reload does not
    // resurface already-confirmed hits or keep publish disabled.
    void getOfferPromiseConfirmationsAction(offerId).then((stored) => {
      if (stored.length > 0) setPromiseConfirmations(stored);
    });
  }, [offerId]);

  // Spec 07 promise check: scan the intro, package names, credit reason,
  // bonus/option names + descriptions, and the cover email + SMS bodies staff
  // are about to send.
  const promiseHits = useMemo<PromiseHit[]>(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const resolvedPrimary = resolvePrimaryContact(contactInfo);
    const recipientFirstName = resolvedPrimary.firstName || contactInfo.owners[0]?.firstName || "there";
    const ownersWithPhones = contactInfo.owners.filter((owner) => owner.phone.trim());
    const ownerNames = ownersWithPhones
      .map((owner) => formatPersonName(owner.firstName, owner.lastName))
      .filter(Boolean);
    const cover = effectiveCoverBodies(offerKind, {
      brandName: brand.name,
      companyName: contactInfo.companyName || "your business",
      recipientFirstName,
      proposalUrl: publicPath ? `${origin}${publicPath}` : "",
      smsRecipientLabel: ownerNames.join(" and ") || "there",
    });
    return scanPromiseRisks([
      ...collectPromiseFieldsFromAssessment(assessment),
      { where: "Cover email", text: normalizeCoverTextForScan(`${cover.emailSubject}\n\n${cover.emailBody}`) },
      { where: "Cover SMS", text: normalizeCoverTextForScan(cover.smsBody) },
    ]);
  }, [assessment, brand.name, contactInfo, offerKind, publicPath]);
  const unresolvedPromiseHitsList = useMemo(
    () => unresolvedPromiseHits(promiseHits, promiseConfirmations),
    [promiseHits, promiseConfirmations],
  );

  async function persistConfirmations(next: PromiseConfirmation[]) {
    if (!offerId) throw new Error("Save this proposal as an offer before confirming wording.");
    const localState = readProposalBuilderLocalState();
    await saveOfferDraftAction(offerId, {
      contactInfo: localState.contactInfo,
      assessment: localState.assessment,
      isTestProposal: localState.assessment?.isTestProposal === true,
      pricing: getProposalPricingSnapshotPricing(localState.assessment as AssessmentState),
      promiseConfirmations: next,
    });
  }

  async function confirmHitKept(hit: PromiseHit) {
    const key = `${hit.where} ${hit.phrase} ${hit.textHash}`;
    setConfirmingHit(key);
    try {
      const next = [
        ...promiseConfirmations,
        {
          where: hit.where,
          phrase: hit.phrase,
          textHash: hit.textHash,
          confirmedAt: new Date().toISOString(),
        },
      ];
      await persistConfirmations(next);
      setPromiseConfirmations(next);
      setSaveStatus("saved");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save the confirmation");
      setSaveStatus("error");
    } finally {
      setConfirmingHit(null);
    }
  }

  async function saveDraft() {
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const localState = readProposalBuilderLocalState();
      const contactInfo = localState.contactInfo as ContactInfoState | undefined;
      const people =
        contactInfo?.owners
          .map((owner) => ({
            contactId: owner.crmContactId ?? "",
            firstName: owner.firstName,
            lastName: owner.lastName,
            email: owner.email,
            phone: owner.phone,
            roleTitle:
              contactInfo.primaryContact.ownerId === owner.id
                ? contactInfo.primaryContact.role
                : "",
          }))
          .filter((person) => person.contactId) ?? [];
      if (people.length > 0) {
        await syncOfferContactsAction({
          companyName: contactInfo?.companyName ?? "",
          people,
        });
      }
      if (offerId) {
        await saveOfferDraftAction(offerId, {
          contactInfo,
          assessment: localState.assessment,
          isTestProposal: localState.assessment?.isTestProposal === true,
          pricing: getProposalPricingSnapshotPricing(localState.assessment as AssessmentState),
        });
      }
      setSaveStatus("saved");
    } catch (error) {
      setSaveStatus("error");
      setSaveError(error instanceof Error ? error.message : "Save failed");
    }
  }

  async function publishOffer() {
    if (unresolvedPromiseHitsList.length > 0) {
      setPublishStatus("error");
      setPublishError(
        `Resolve the ${unresolvedPromiseHitsList.length === 1 ? "flagged wording" : "flagged wordings"} in the promise check below first — edit it or confirm “Keep this wording”.`,
      );
      return;
    }
    setPublishStatus("publishing");
    setPublishError(null);
    try {
      const localState = readProposalBuilderLocalState();
      const contactInfo = localState.contactInfo as ContactInfoState | undefined;
      const people =
        contactInfo?.owners
          .map((owner) => ({
            contactId: owner.crmContactId ?? "",
            firstName: owner.firstName,
            lastName: owner.lastName,
            email: owner.email,
            phone: owner.phone,
            roleTitle:
              contactInfo.primaryContact.ownerId === owner.id
                ? contactInfo.primaryContact.role
                : "",
          }))
          .filter((person) => person.contactId) ?? [];
      if (people.length > 0) {
        await syncOfferContactsAction({
          companyName: contactInfo?.companyName ?? "",
          people,
        });
      }
      if (!offerId) throw new Error("Save this proposal as an offer before publishing it.");
      const result = await publishOfferChangesAction(offerId, {
        contactInfo,
        assessment: localState.assessment,
        isTestProposal: localState.assessment?.isTestProposal === true,
        pricing: getProposalPricingSnapshotPricing(localState.assessment as AssessmentState),
        promiseConfirmations,
      });
      window.localStorage.setItem(`proposal-public-path:${offerId}`, result.publicPath);
      setPublishedVersion(result.version);
      setPublishStatus("published");
    } catch (error) {
      setPublishStatus("error");
      setPublishError(error instanceof Error ? error.message : "Publish failed");
    }
  }

  const saveDone = saveStatus === "saved";
  const publishDone = publishStatus === "published";

  const stepButtonClass = (done: boolean) =>
    done
      ? "inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
      : "ui-action-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <main className="min-h-screen">
      <section className="w-full px-5 py-6 lg:px-8">
        <ProposalAppDemoHeader
          currentStep="finalize"
        />
        <CompanyMismatchWarningForOffer offerId={offerId} />

        <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px] 2xl:grid-cols-[minmax(0,1fr)_300px]">
          <div>
            <section className="proposal-builder-card overflow-hidden rounded-[1.5rem] border border-slate-300 shadow-sm">
              <div className="border-b border-slate-200 bg-white px-5 py-6">
                <h2 className="text-lg font-semibold tracking-tight text-slate-900">1. Save</h2>
                <p className="mt-4 text-sm text-slate-500">
                  Store the current builder state as a draft
                  {offerId ? (
                    <>
                      {" "}for offer <span className="font-mono">{offerId}</span>
                    </>
                  ) : (
                    " (an offer is created on first save)"
                  )}
                  .
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void saveDraft()}
                    disabled={saveStatus === "saving"}
                    className={stepButtonClass(saveDone)}
                  >
                    <Save className="h-4 w-4" />
                    {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : "Save draft"}
                  </button>
                </div>
                {saveStatus === "error" && saveError ? (
                  <p className="mt-3 text-sm text-rose-700">{saveError}</p>
                ) : null}
              </div>
              <div className="border-b border-slate-200 bg-slate-50 px-5 py-6">
                <h2 className="text-lg font-semibold tracking-tight text-slate-900">2. Publish</h2>
                <p className="mt-4 text-sm text-slate-500">
                  Generate the client-facing proposal link.
                  Publishing snapshots the current pricing and agreement text.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void publishOffer()}
                    disabled={!saveDone || publishStatus === "publishing" || unresolvedPromiseHitsList.length > 0}
                    title={!offerId ? "Save this proposal as an offer before publishing it." : !saveDone ? "Save the draft first." : unresolvedPromiseHitsList.length > 0 ? "Resolve the promise check below first." : undefined}
                    className={stepButtonClass(publishDone)}
                  >
                    <Upload className="h-4 w-4" />
                    {publishStatus === "publishing"
                      ? "Publishing…"
                      : publishStatus === "published"
                        ? `Published${publishedVersion ? ` v${publishedVersion}` : ""}`
                        : "Publish offer"}
                  </button>
                </div>
                {publishStatus === "error" && publishError ? (
                  <p className="mt-3 text-sm text-rose-700">{publishError}</p>
                ) : null}
              </div>
              <div className="border-b border-slate-200 bg-white px-5 py-6">
                <h2 className="text-lg font-semibold tracking-tight text-slate-900">3. Promise check</h2>
                <p className="mt-4 text-sm text-slate-500">
                  The agreement excludes tax filing, CPA work, audits, and 24/7 availability.
                  Flagged wording below must be edited or confirmed before publishing or sending.
                </p>
                {unresolvedPromiseHitsList.length === 0 ? (
                  <p className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    {promiseHits.length === 0
                      ? "No risky wording found — nothing here promises more than the agreement covers."
                      : "All flagged wording is confirmed — publishing and sending are unblocked."}
                  </p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {unresolvedPromiseHitsList.map((hit) => {
                      const key = `${hit.where} ${hit.phrase} ${hit.textHash}`;
                      return (
                        <li key={key} className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
                          <p className="flex items-center gap-2 text-sm font-semibold text-amber-950">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            {hit.where} — “{hit.phrase}”
                          </p>
                          <p className="mt-1 text-sm text-amber-900">…{hit.snippet}…</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Link
                              href={editHrefForHit(hit.where, query)}
                              className="inline-flex items-center gap-2 rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
                            >
                              Edit
                            </Link>
                            <button
                              type="button"
                              onClick={() => void confirmHitKept(hit)}
                              disabled={confirmingHit === key}
                              className="inline-flex items-center gap-2 rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {confirmingHit === key ? "Saving…" : "Keep this wording"}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div className="bg-white px-5 py-6">
                <h2 className="text-lg font-semibold tracking-tight text-slate-900">4. Send</h2>
                <p className="mt-4 text-sm text-slate-500">
                  Continue to the email step to send the proposal from your connected
                  mailbox, or mark it as sent if you shared the link another way.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {publishDone ? (
                    <Link
                      href={withQuery("/offers/cover", query)}
                      className="ui-action-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"
                    >
                      <Send className="h-4 w-4" />
                      Continue to email
                    </Link>
                  ) : (
                    <span
                      title="Publish the offer first."
                      className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-400 opacity-60"
                    >
                      <Send className="h-4 w-4" />
                      Continue to email
                    </span>
                  )}
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  Tip: the eye icon above opens the full-screen proposal preview.
                </p>
              </div>
            </section>
          </div>
          <PricingSnapshotSidebar
            items={getProposalPricingSnapshotItems(assessment)}
            cleanupCard={getProposalPricingSnapshotCleanupCard(assessment)}
            hideLabel
          />
        </div>
      </section>
    </main>
  );
}
