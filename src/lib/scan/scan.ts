/** Shared shapes and pure helpers for the header Scan button (sop-money-playbook). */

export const SCAN_SOURCES = ["quo", "zoho", "swapp", "ga4"] as const;
export type ScanSource = (typeof SCAN_SOURCES)[number];

export type ScanChange = { kind: string; text: string };

export type ScanLeadInput = {
  brand: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  company?: string | null;
  source: ScanSource | string;
  sourceDetail?: string | null;
  note?: string | null;
};

export type ScanSignedHint = {
  fromName?: string | null;
  fromEmail: string;
  subject?: string | null;
  snippet?: string | null;
  receivedAt?: string | null;
};

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

/** "Updated N min ago" caption for the header. */
export function formatUpdatedAgo(finishedAt: Date | null, now: Date = new Date()): string {
  if (!finishedAt || Number.isNaN(finishedAt.getTime())) return "Never scanned";
  const minutes = Math.max(0, Math.floor((now.getTime() - finishedAt.getTime()) / 60_000));
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `Updated ${days} d ago`;
}

export function parseScanChange(raw: unknown): ScanChange | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const kind = clean(row.kind, 40);
  const text = clean(row.text, 280);
  if (!kind || !text) return null;
  return { kind, text };
}

export function parseScanLead(raw: unknown): ScanLeadInput | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const brand = clean(row.brand, 80);
  const name = clean(row.name, 200);
  if (!brand || !name) return null;
  const email = clean(row.email, 254)?.toLowerCase() ?? null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return null;
  const source = clean(row.source, 20) ?? "quo";
  return {
    brand,
    name,
    phone: clean(row.phone, 64),
    email,
    company: clean(row.company, 200),
    source,
    sourceDetail: clean(row.sourceDetail, 200),
    note: clean(row.note, 1000),
  };
}

export function parseSignedHint(raw: unknown): ScanSignedHint | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const fromEmail = clean(row.fromEmail ?? row.from_email, 254)?.toLowerCase() ?? null;
  if (!fromEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fromEmail)) return null;
  return {
    fromName: clean(row.fromName ?? row.from_name, 200),
    fromEmail,
    subject: clean(row.subject, 300),
    snippet: clean(row.snippet, 500),
    receivedAt: clean(row.receivedAt ?? row.received_at, 40),
  };
}

/** Client replies that hint a sent GSA came back signed. Hints only: Tom's
 * documents rule means the scan never marks anything signed by itself. */
const SIGNED_HINT = /(sign|docusign|execut|countersign|sent\s+(it\s+)?back|\bdone\b)/i;
export function looksLikeSignedReply(subject: string | null, snippet: string | null): boolean {
  const text = `${subject ?? ""} ${snippet ?? ""}`.toLowerCase();
  if (!/(sign|gsa|agreement|contract|paperwork|docusign|proposal|quote|engagement|done)/.test(text)) return false;
  return SIGNED_HINT.test(text);
}

/** A scan nobody picked up. The poller fires every few seconds, so a
 * requested run older than this has no poller watching; a running run older
 * than its own bound means the poller died mid-run. */
export const STALE_REQUESTED_MS = 4 * 60 * 1000;
export const STALE_RUNNING_MS = 30 * 60 * 1000;

export type ScanRunState = {
  status: string;
  requestedAt: Date | string | null;
  startedAt: Date | string | null;
};

function asTime(value: Date | string | null): number {
  if (!value) return Number.NaN;
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(time) ? time : Number.NaN;
}

/** "stale" means the spinner would otherwise spin forever: request/claim
 * mark it errored and move on instead of stacking behind it. */
export function scanRunStaleness(run: ScanRunState | null, now: Date = new Date()): "fresh" | "stale" | "none" {
  if (!run || (run.status !== "requested" && run.status !== "running")) return "none";
  const base = run.status === "running" ? asTime(run.startedAt) || asTime(run.requestedAt) : asTime(run.requestedAt);
  if (Number.isNaN(base)) return "fresh";
  const limit = run.status === "running" ? STALE_RUNNING_MS : STALE_REQUESTED_MS;
  return now.getTime() - base > limit ? "stale" : "fresh";
}
