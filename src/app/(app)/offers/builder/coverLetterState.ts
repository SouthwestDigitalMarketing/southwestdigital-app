// Server-safe (every window access is guarded): the email-send route imports
// the scan normalization from here.
import { assessmentStorageKey } from "./ProposalBuilderStorage";

export type CoverLetterBodies = {
  emailSubject?: string;
  emailBody?: string;
  smsBody?: string;
  /** The proposal URL the bodies above were written against, for re-stamping. */
  proposalUrl?: string;
};

function coverLetterStorageKey() {
  if (typeof window === "undefined") return null;
  return `${assessmentStorageKey()}:cover-letter`;
}

export function readCoverLetterOverrides(): CoverLetterBodies | null {
  if (typeof window === "undefined") return null;
  const key = coverLetterStorageKey();
  if (!key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const picked: CoverLetterBodies = {};
    if (typeof parsed.emailSubject === "string") picked.emailSubject = parsed.emailSubject;
    if (typeof parsed.emailBody === "string") picked.emailBody = parsed.emailBody;
    if (typeof parsed.smsBody === "string") picked.smsBody = parsed.smsBody;
    if (typeof parsed.proposalUrl === "string") picked.proposalUrl = parsed.proposalUrl;
    const hasBody = picked.emailSubject !== undefined || picked.emailBody !== undefined || picked.smsBody !== undefined;
    return hasBody ? picked : null;
  } catch {
    return null;
  }
}

export function writeCoverLetterOverrides(bodies: CoverLetterBodies) {
  if (typeof window === "undefined") return;
  const key = coverLetterStorageKey();
  if (!key) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(bodies));
  } catch {
    // Browser storage can be unavailable; the cover step still works.
  }
}

export type CoverLetterArgs = {
  brandName: string;
  companyName: string;
  recipientFirstName: string;
  proposalUrl: string;
};

export function defaultCoverEmailForKind(kind: string | null, args: CoverLetterArgs) {
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

export function defaultCoverSmsBody(args: CoverLetterArgs) {
  const url = args.proposalUrl || "[Publish changes to generate the proposal link]";
  return `Hi ${args.recipientFirstName},\n\nI put together a bookkeeping proposal for ${args.companyName}. You can review it here:\n${url}\n\n${args.brandName}`;
}

// The proposal link changes when the offer is (re)published, so it is
// normalized out before scanning: confirming "keep this wording" must not
// break the next time the link is stamped in. Both the finalize panel and the
// server-side email refusal scan this normalized form.
export function normalizeCoverTextForScan(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, "[link]")
    .replace("[Publish changes to generate the proposal link]", "[link]");
}

// A persisted body keeps the proposal link it was written against; re-stamp
// just that link (and the unpublished placeholder) to today's URL. Links
// staff added themselves never match the stored URL, so they are untouched.
export function restampCoverLinks(text: string, currentUrl: string, storedUrl?: string): string {
  let restamped = text;
  if (storedUrl && currentUrl && storedUrl !== currentUrl) {
    restamped = restamped.split(storedUrl).join(currentUrl);
  }
  if (currentUrl) {
    restamped = restamped.split("[Publish changes to generate the proposal link]").join(currentUrl);
  }
  return restamped;
}

// The finalize step scans the same bodies the cover step shows: persisted
// staff edits win, otherwise the kind defaults both steps share.
export function effectiveCoverBodies(kind: string | null, args: CoverLetterArgs & { smsRecipientLabel: string }) {
  const overrides = readCoverLetterOverrides();
  const email = defaultCoverEmailForKind(kind, args);
  const restamp = (text: string) => restampCoverLinks(text, args.proposalUrl, overrides?.proposalUrl);
  return {
    emailSubject: overrides?.emailSubject !== undefined ? restamp(overrides.emailSubject) : email.subject,
    emailBody: overrides?.emailBody !== undefined ? restamp(overrides.emailBody) : email.body,
    smsBody: overrides?.smsBody !== undefined
      ? restamp(overrides.smsBody)
      : defaultCoverSmsBody({ ...args, recipientFirstName: args.smsRecipientLabel }),
  };
}
