"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, MessageSquare, Send } from "lucide-react";
import ProposalAppDemoHeader from "./ProposalAppDemoHeader";
import {
  formatPersonName,
  resolvePrimaryContact,
  useProposalContactInfoDemoState,
} from "./ProposalContactInfoState";
import { useBrand } from "@/lib/brands/context";
import { getOfferKindAction, getOfferPublicPathAction } from "../who/actions";
import { markQuoteSentAction } from "../actions";
import { MessageTemplateManager, type MessageTemplate } from "./MessageTemplateManager";

function defaultCopyForKind(kind: string | null, args: { brandName: string; companyName: string; recipientFirstName: string; proposalUrl: string }) {
  const url = args.proposalUrl || "[Publish changes to generate the proposal link]";
  if (kind === "consulting") {
    return {
      subject: `Consulting proposal for ${args.companyName}`,
      body: `Hi ${args.recipientFirstName},\n\nThanks for reaching out. I put together a consulting proposal outlining the scope, hours, and rate.\n\nReview it here:\n${url}\n\nOnce you sign and pay, we'll schedule the first session.\n\nThank you,\n${args.brandName}`,
    };
  }
  if (kind === "coaching") {
    return {
      subject: `Coaching proposal for ${args.recipientFirstName}`,
      body: `Hi ${args.recipientFirstName},\n\nHere's the coaching proposal we discussed. It shows the session count, pace, and total investment.\n\nReview it here:\n${url}\n\nOnce you sign and pay, we can book your first session and start.\n\nThank you,\n${args.brandName}`,
    };
  }
  return {
    subject: `Your bookkeeping proposal for ${args.companyName}`,
    body: `Hi ${args.recipientFirstName},\n\nThank you for taking the time to meet with me. I put together a bookkeeping proposal for ${args.companyName}.\n\nYou can review it here:\n${url}\n\nThe proposal shows your service options, what each option includes, and the price. You can pick the option that works best for you.\n\n${args.brandName} would be glad to help you get clear, organized books and reach your goals.\n\nThank you,\n${args.brandName}`,
  };
}

type FollowUpKind = "unviewed" | "unsigned" | "unpaid";

// Follow-up copy is intentionally short, warm, and does not repeat the
// full proposal pitch. Each variant reflects the client's actual state
// so the message doesn't sound like a canned reminder.
function followUpCopy(followUp: FollowUpKind, args: { brandName: string; companyName: string; recipientFirstName: string; proposalUrl: string }) {
  const url = args.proposalUrl || "[Publish changes to generate the proposal link]";
  if (followUp === "unviewed") {
    return {
      subject: `Following up on your ${args.companyName} proposal`,
      body: `Hi ${args.recipientFirstName},\n\nI wanted to check in on the proposal I sent over. Want to make sure it landed and didn't get buried in your inbox.\n\nHere's the link again:\n${url}\n\nAny questions, just reply to this email.\n\nThank you,\n${args.brandName}`,
    };
  }
  if (followUp === "unsigned") {
    return {
      subject: `Any questions on the ${args.companyName} proposal?`,
      body: `Hi ${args.recipientFirstName},\n\nJust checking in — I noticed you had a chance to look at the proposal but haven't signed yet. Wanted to see if there's anything I can clarify or adjust to make it easier to move forward.\n\nProposal link:\n${url}\n\nHappy to jump on a quick call if that would help.\n\nThank you,\n${args.brandName}`,
    };
  }
  return {
    subject: `Payment for your ${args.companyName} engagement`,
    body: `Hi ${args.recipientFirstName},\n\nThanks again for signing the agreement. Just a quick reminder to complete the payment so we can get started on your engagement.\n\nYou can pay here:\n${url}\n\nLet me know if you hit any trouble with the payment link.\n\nThank you,\n${args.brandName}`,
  };
}

function isFollowUpKind(value: string | null): value is FollowUpKind {
  return value === "unviewed" || value === "unsigned" || value === "unpaid";
}

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
  const [offerId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("offer");
  });
  const [followUp] = useState<FollowUpKind | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = new URLSearchParams(window.location.search).get("followUp");
    return isFollowUpKind(raw) ? raw : null;
  });
  const [offerKind, setOfferKind] = useState<string | null>(null);
  const [sendState, setSendState] = useState<
    | { kind: "idle" }
    | { kind: "sending" }
    | { kind: "sent"; from: string }
    | { kind: "error"; message: string; code?: string }
  >({ kind: "idle" });
  const [markSentState, setMarkSentState] = useState<
    | { kind: "idle" }
    | { kind: "marked" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const [markSentPending, startMarkSent] = useTransition();

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
  const kindDefaults = followUp
    ? followUpCopy(followUp, {
        brandName: brand.name,
        companyName,
        recipientFirstName,
        proposalUrl,
      })
    : defaultCopyForKind(offerKind, {
        brandName: brand.name,
        companyName,
        recipientFirstName,
        proposalUrl,
      });
  const subject = kindDefaults.subject;
  const defaultEmailBody = kindDefaults.body;
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
    if (!offerId) return;
    void getOfferPublicPathAction(offerId).then((path) => {
      setPublicPath(path ?? "");
    });
    void getOfferKindAction(offerId).then((kind) => {
      setOfferKind(kind);
    });
  }, [offerId]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(completeEmail);
      setCopied(true);
    } catch {
      // Clipboard access can fail in an insecure browser context.
    }
  }

  function handleMarkAsSent() {
    if (!offerId) return;
    setMarkSentState({ kind: "idle" });
    startMarkSent(async () => {
      try {
        const data = new FormData();
        data.set("id", offerId);
        await markQuoteSentAction(data);
        setMarkSentState({ kind: "marked" });
      } catch (error) {
        // markQuoteSentAction ends with a redirect() to /offers/{id}?sent=1.
        // Next.js signals that as a thrown error with a NEXT_REDIRECT digest;
        // let it propagate so navigation happens.
        const digest =
          error && typeof error === "object" && "digest" in error
            ? String((error as { digest?: unknown }).digest ?? "")
            : "";
        if (digest.startsWith("NEXT_REDIRECT")) throw error;
        setMarkSentState({
          kind: "error",
          message: error instanceof Error ? error.message : "Could not mark as sent",
        });
      }
    });
  }

  async function handleSend() {
    if (!recipientEmail || !proposalUrl) return;
    setSendState({ kind: "sending" });
    try {
      const response = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: recipientEmail,
          subject: effectiveEmailSubject,
          body: effectiveEmailBody,
          offerId,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; code?: string; from?: string };
      if (response.ok) {
        setSendState({ kind: "sent", from: data.from ?? "" });
      } else {
        setSendState({
          kind: "error",
          message: data.error ?? "Send failed",
          code: data.code,
        });
      }
    } catch (error) {
      setSendState({
        kind: "error",
        message: error instanceof Error ? error.message : "Network error",
      });
    }
  }

  const canSend = Boolean(recipientEmail) && Boolean(proposalUrl) && sendState.kind !== "sending";

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
                    href={`${proposalUrl}${proposalUrl.includes("?") ? "&" : "?"}staffPreview=1`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Preview proposal as staff (opens in new tab)"
                    title="Preview as staff — sign/pay actions are disabled so you can't submit on the client's behalf. The link the client receives is the plain URL shown above."
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

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={!canSend}
                className="ui-action-primary inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
                {sendState.kind === "sending" ? "Sending…" : "Send from your mailbox"}
              </button>
              <button
                type="button"
                onClick={() => void handleCopy()}
                disabled={!proposalUrl}
                className="ui-action-ghost inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied!" : "Copy email"}
              </button>
              <button
                type="button"
                onClick={handleMarkAsSent}
                disabled={!offerId || markSentPending}
                title="Use this only if you already sent the proposal via a channel outside the app (personal email, text, WhatsApp, etc.)."
                className="ui-action-ghost inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
              >
                {markSentPending ? "Marking…" : "I sent it another way — mark as sent"}
              </button>
            </div>

            {markSentState.kind === "marked" ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Marked as sent.
              </p>
            ) : null}
            {markSentState.kind === "error" ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {markSentState.message}
              </p>
            ) : null}

            {sendState.kind === "sent" ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Sent {sendState.from ? `from ${sendState.from}` : ""}. Check your Sent folder to confirm.
              </p>
            ) : null}

            {sendState.kind === "error" && sendState.code === "not-connected" ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Connect your mailbox in{" "}
                <Link href="/settings" className="font-semibold underline">
                  Settings → Email connections
                </Link>{" "}
                so you can send from the app. In the meantime you can Copy email and paste it into your mail client.
              </p>
            ) : null}

            {sendState.kind === "error" && sendState.code !== "not-connected" ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {sendState.message}
              </p>
            ) : null}
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
