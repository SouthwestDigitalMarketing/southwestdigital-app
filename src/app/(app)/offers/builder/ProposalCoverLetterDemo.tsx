"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, MessageSquare } from "lucide-react";
import ProposalAppDemoHeader from "./ProposalAppDemoHeader";
import {
  formatPersonName,
  resolvePrimaryContact,
  useProposalContactInfoDemoState,
} from "./ProposalContactInfoState";
import { useBrand } from "@/lib/brands/context";
import { getOfferPublicPathAction } from "../who/actions";
import { MessageTemplateManager, type MessageTemplate } from "./MessageTemplateManager";

const INPUT_CLASS_NAME =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-brandnavy focus:outline-none focus:ring-2 focus:ring-brandnavy/10";
const FIELD_LABEL_CLASS =
  "text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500";

function renderMessageTemplate(template: string, values: Record<string, string>) {
  return template.replace(/{{\s*([a-zA-Z]+)\s*}}/g, (_, key: string) => values[key] ?? "");
}

export default function ProposalCoverLetterDemo() {
  const { brand } = useBrand();
  const { contactInfo } = useProposalContactInfoDemoState();
  const [copied, setCopied] = useState(false);
  const [publicPath, setPublicPath] = useState("");

  const resolvedPrimaryContact = resolvePrimaryContact(contactInfo);
  const fallbackOwner = contactInfo.owners[0];
  const recipientFirstName =
    resolvedPrimaryContact.firstName || fallbackOwner?.firstName || "there";
  const recipientEmail = resolvedPrimaryContact.email || fallbackOwner?.email || "";
  const recipientName =
    formatPersonName(resolvedPrimaryContact.firstName, resolvedPrimaryContact.lastName) ||
    (fallbackOwner ? formatPersonName(fallbackOwner.firstName, fallbackOwner.lastName) : "");
  const companyName = contactInfo.companyName || "your business";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const proposalUrl = publicPath ? `${origin}${publicPath}` : "";
  const subject = `Your bookkeeping proposal for ${companyName}`;
  const defaultEmailBody = `Hi ${recipientFirstName},

Thank you for taking the time to meet with me. I put together a bookkeeping proposal for ${companyName}.

You can review it here:
${proposalUrl || "[Publish changes to generate the proposal link]"}

The proposal shows your service options, what each option includes, and the price. You can pick the option that works best for you.

${brand.name} would be glad to help you get clear, organized books and reach your goals.

Thank you,
${brand.name}`;
  const [emailBody, setEmailBody] = useState<string | null>(null);
  const effectiveEmailBody = emailBody ?? defaultEmailBody;
  const [emailSubject, setEmailSubject] = useState<string | null>(null);
  const effectiveEmailSubject = emailSubject ?? subject;
  const ownersWithPhones = contactInfo.owners.filter((owner) => owner.phone.trim());
  const ownerNames = ownersWithPhones
    .map((owner) => formatPersonName(owner.firstName, owner.lastName))
    .filter(Boolean);
  const smsRecipients = ownersWithPhones
    .map((owner) => owner.phone.replace(/[^+\d]/g, ""))
    .filter(Boolean);
  const defaultSmsBody = `Hi ${ownerNames.join(" and ") || "there"},

I put together a bookkeeping proposal for ${companyName}. You can review it here:
${proposalUrl || "[Publish changes to generate the proposal link]"}

${brand.name}`;
  const [smsBody, setSmsBody] = useState<string | null>(null);
  const effectiveSmsBody = smsBody ?? defaultSmsBody;
  const smsHref = proposalUrl && smsRecipients.length
    ? `sms:${smsRecipients.join(",")}?body=${encodeURIComponent(effectiveSmsBody)}`
    : "";
  const completeEmail = `To: ${recipientName}${recipientEmail ? ` <${recipientEmail}>` : ""}
Subject: ${effectiveEmailSubject}

${effectiveEmailBody}`;

  const templateValues = {
    firstName: recipientFirstName,
    ownerNames: ownerNames.join(" and ") || "there",
    companyName,
    proposalUrl: proposalUrl || "[Publish changes to generate the proposal link]",
    brandName: brand.name,
  };

  function applyEmailTemplate(template: MessageTemplate) {
    setEmailSubject(renderMessageTemplate(template.subject || subject, templateValues));
    setEmailBody(renderMessageTemplate(template.content, templateValues));
  }

  function applyTextTemplate(template: MessageTemplate) {
    setSmsBody(renderMessageTemplate(template.content, templateValues));
  }

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  useEffect(() => {
    const offerId = new URLSearchParams(window.location.search).get("offer");
    if (!offerId) return;
    void getOfferPublicPathAction(offerId).then((path) => {
      setPublicPath(path ?? "");
    });
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(completeEmail);
      setCopied(true);
    } catch {
      // Clipboard access can fail in an insecure browser context.
    }
  }

  return (
    <main className="min-h-screen">
      <section className="mx-auto w-full max-w-[1720px] px-5 py-6 lg:px-8">
        <ProposalAppDemoHeader
          currentStep="cover"
          previousHref="/offers/add-ons"
        />

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <section className="theme-white space-y-5 rounded-2xl border border-slate-200 p-6 shadow-sm lg:p-8">
            <div>
              <h1 className="text-xl font-bold text-slate-950">Client Email</h1>
              <p className="mt-1 text-sm text-slate-500">
                Copy this email and send it to the client with their proposal link.
              </p>
            </div>

            <MessageTemplateManager channel="email" onApply={applyEmailTemplate} />

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className={FIELD_LABEL_CLASS}>To</span>
                <input readOnly value={recipientEmail} className={INPUT_CLASS_NAME} />
              </label>
              <label className="grid gap-2">
                <span className={FIELD_LABEL_CLASS}>Subject</span>
                <input readOnly value={effectiveEmailSubject} className={INPUT_CLASS_NAME} />
              </label>
            </div>

            <label className="grid gap-2">
              <span className={FIELD_LABEL_CLASS}>Proposal Link</span>
              <span className="flex gap-2">
                <input readOnly value={proposalUrl || "Publish changes to generate a client link."} className={INPUT_CLASS_NAME} />
                {proposalUrl ? (
                  <a
                    href={proposalUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open proposal link"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-300 text-slate-600 transition hover:bg-slate-50"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : (
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-300">
                    <ExternalLink className="h-4 w-4" />
                  </span>
                )}
              </span>
            </label>

            <label className="grid gap-2">
              <span className={FIELD_LABEL_CLASS}>Email</span>
              <textarea readOnly rows={17} value={effectiveEmailBody} className={`${INPUT_CLASS_NAME} leading-6`} />
            </label>

            <button
              type="button"
              onClick={() => void handleCopy()}
              disabled={!proposalUrl}
              className="ui-action-primary inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied!" : "Copy Email"}
            </button>
          </section>

          <section className="theme-white space-y-5 rounded-2xl border border-slate-200 p-6 shadow-sm lg:p-8">
              <div>
                <h2 className="text-xl font-bold text-slate-950">Client Text Message</h2>
                <p className="mt-1 text-sm text-slate-500">
                  This defaults to the owners listed in the Contacts step. Edit the message, then open it in your messaging app.
                </p>
              </div>

              <MessageTemplateManager channel="text" onApply={applyTextTemplate} />

              <label className="mt-4 grid gap-2">
                <span className={FIELD_LABEL_CLASS}>To</span>
                <input
                  readOnly
                  value={ownersWithPhones.map((owner) => owner.phone).join(", ")}
                  placeholder="Add owner phone numbers in the Contacts step"
                  className={INPUT_CLASS_NAME}
                />
              </label>

              <label className="mt-4 grid gap-2">
                <span className={FIELD_LABEL_CLASS}>Text message</span>
                <textarea
                  rows={8}
                  value={effectiveSmsBody}
                  onChange={(event) => setSmsBody(event.target.value)}
                  className={`${INPUT_CLASS_NAME} leading-6`}
                />
              </label>

              <a
                href={smsHref || undefined}
                aria-disabled={!smsHref}
                className="ui-action-primary mt-4 inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold shadow-sm transition aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
              >
                <MessageSquare className="h-4 w-4" />
                Open Text Message
              </a>
          </section>
        </div>
      </section>
    </main>
  );
}
