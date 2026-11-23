/** Per-source live progress for the Scan modal (Tom 2026-11-23). */

export type ScanSourceStatus = "waiting" | "scanning" | "done" | "needs-you";

export type ScanSourceState = {
  source: string;
  label: string;
  status: ScanSourceStatus;
  detail?: string | null;
  loginUrl?: string | null;
  loginLabel?: string | null;
};

export const QBO_LOGIN_URL = "https://app.qbo.intuit.com";

const DEFS: { source: string; label: string; loginUrl?: string; loginLabel?: string; needsLogin?: boolean }[] = [
  // Human-login sources first: they pin at the top until Tom signs in.
  // v1 only checks their login state; the QBO sync itself comes later.
  // One QuickBooks line (access + Contracts share one sign-in).
  { source: "quickbooks", label: "QuickBooks", loginUrl: QBO_LOGIN_URL, loginLabel: "Log in", needsLogin: true },
  { source: "quo-sms", label: "Texts (Quo)" },
  { source: "quo-calls", label: "Calls (Quo)" },
  { source: "quo-voicemail", label: "Voicemail (Quo)" },
  { source: "zoho", label: "Email (Zoho)" },
  { source: "swapp", label: "Proposals (SWapp)" },
  { source: "ga4", label: "Traffic (GA4)" },
];

/** Fresh per-source rows for a new run: the QuickBooks line starts needing
 * Tom with no explanation text, just the label and the Log in link. */
export function initialSources(): ScanSourceState[] {
  return DEFS.map((def) => ({
    source: def.source,
    label: def.label,
    status: def.needsLogin ? "needs-you" : "waiting",
    detail: null,
    loginUrl: def.loginUrl ?? null,
    loginLabel: def.loginLabel ?? null,
  }));
}

const KNOWN = new Set(DEFS.map((def) => def.source));

export function isKnownSource(source: string): boolean {
  return KNOWN.has(source);
}

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

export function parseSourceProgress(raw: unknown): {
  source: string;
  status: ScanSourceStatus;
  detail: string | null;
  loginUrl: string | null;
  loginLabel: string | null;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const source = clean(row.source, 40);
  const status = clean(row.status, 20);
  if (!source || !KNOWN.has(source)) return null;
  if (status !== "waiting" && status !== "scanning" && status !== "done" && status !== "needs-you") return null;
  const loginUrl = clean(row.loginUrl, 500);
  if (loginUrl && !/^https:\/\//.test(loginUrl)) return null;
  return {
    source,
    status,
    detail: clean(row.detail, 280),
    loginUrl,
    loginLabel: clean(row.loginLabel, 80),
  };
}

/** Modal order: anything needing Tom first, then in-flight, then waiting, then done. */
export function sortSources(sources: ScanSourceState[]): ScanSourceState[] {
  const rank = (status: ScanSourceStatus) =>
    status === "needs-you" ? 0 : status === "scanning" ? 1 : status === "waiting" ? 2 : 3;
  return [...sources].sort((a, b) => rank(a.status) - rank(b.status));
}
