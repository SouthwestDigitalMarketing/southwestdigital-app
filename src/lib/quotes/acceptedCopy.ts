import "server-only";

import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import { DomainPurpose, DomainStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeHostname } from "@/lib/brands/hostname";
import { asRecord, readAcceptedSelection } from "@/lib/engagements/acceptedPayment";
import { parseStoredHourlyCheckout } from "@/lib/engagements/hourlyCheckout";
import { parseStoredProposalCheckout } from "@/lib/engagements/proposalCheckout";
import { INTERNAL_VIEWER_COOKIE } from "./internalViewer";
import { isQuoteFrozen } from "./isQuoteFrozen";

export type AcceptedProposalCopy = {
  version: 2;
  encoding: "gzip+base64";
  /** gzip-compressed UTF-8 of the sanitized standalone HTML, base64-encoded. */
  html: string;
  /** sha256 of the UNCOMPRESSED html bytes (UTF-8). */
  sha256: string;
  savedAt: string;
  gitSha: string | null;
  source: "accept" | "backfill";
  quoteId: string;
  /** Path of the fetched public page (never written to logs; may carry the token). */
  sourceUrlPath: string;
  cssInlined: boolean;
  /** Same-origin assets embedded as data URIs (capped); anything else stayed a placeholder. */
  assetsInlined: { images: number; fonts: number; skipped: number };
  selection: Record<string, unknown>;
};

export const ACCEPTED_COPY_CSP =
  "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

const COPY_FETCH_TIMEOUT_MS = 15_000;
const MAX_COPY_HTML_BYTES = 5_000_000;
/** Per-asset cap for embedded images/fonts; anything larger stays a placeholder. */
const MAX_COPY_ASSET_BYTES = 200_000;
/** Total cap for all embedded assets in one copy. */
const MAX_COPY_ASSETS_TOTAL_BYTES = 2_000_000;

export type AcceptedCopyFetch = typeof fetch;

function escapeArchiveText(value: unknown) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function proposalCopyUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/proposal/${encodeURIComponent(token)}?internal=1`;
}

/** Every linked stylesheet in the fetched page (same-origin output only). */
export function extractStylesheetHrefs(pageHtml: string): string[] {
  const hrefs: string[] = [];
  for (const match of pageHtml.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    if (!/\brel=(["']?)stylesheet\1/i.test(tag)) continue;
    const href = tag.match(/\bhref=(["'])(.*?)\1/i)?.[2];
    if (href && !href.startsWith("data:") && !href.startsWith("blob:")) hrefs.push(href);
  }
  return [...new Set(hrefs)];
}

function sanitizeCss(css: string): string {
  return css.replace(/@import\s+[^;]+;/gi, "")
    .replace(/url\(\s*(["']?)(.*?)\1\s*\)/gi, (all, _quote, url: string) =>
      /^data:(image|font)\//i.test(url) ? all : "none")
    .replace(/<\/style/gi, "<\\/style");
}

/** Makes fetched public-page markup inert: no scripts, handlers, endpoints or remote loads. */
export function sanitizeFetchedProposalHtml(markup: string): string {
  return markup
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script\b[^>]*\/?>/gi, "")
    .replace(/<(iframe|video|audio|object|embed)\b[^>]*>[\s\S]*?<\/\1>/gi,
      '<span role="img" aria-label="Media omitted from saved copy">[Media omitted from saved copy]</span>')
    .replace(/<(iframe|video|audio|object|embed|source|track)\b[^>]*\/?>/gi, "")
    .replace(/<img\b([^>]*?)\/?\s*>/gi, (_tag, attrs: string) => {
      const src = attrs.match(/\bsrc="([^"]*)"/)?.[1] ?? "";
      if (/^data:image\/(png|jpeg|gif|webp|avif);base64,[a-z0-9+/=]+$/i.test(src) && src.length <= 350_000) {
        return `<img${attrs.replace(/\son\w+="[^"]*"/gi, "").replace(/\son\w+='[^']*'/gi, "")}>`;
      }
      const alt = escapeArchiveText(attrs.match(/\balt="([^"]*)"/)?.[1] ?? "Image");
      const className = escapeArchiveText(attrs.match(/\bclass="([^"]*)"/)?.[1] ?? "");
      return `<span role="img" class="${className}" aria-label="${alt}">[${alt}]</span>`;
    })
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/\s(?:href|srcset|action|formaction|poster|xlink:href)="[^"]*"/gi, "")
    .replace(/\s(?:href|srcset|action|formaction|poster|xlink:href)='[^']*'/gi, "")
    // Embedded same-origin captures survive as data: URIs (matching the
    // served copy's `img-src data:` CSP); every other src is stripped.
    .replace(/\ssrc="(?!data:(?:image|font)\/)[^"]*"/gi, "")
    .replace(/\ssrc='(?!data:(?:image|font)\/)[^']*'/gi, "")
    .replace(/<(button|input|select|textarea)\b/gi, "<$1 disabled")
    .replace(/<form\b[^>]*>/gi, "<div>").replace(/<\/form>/gi, "</div>")
    .replace(/<dialog\b/gi, '<section data-archive-comparison="true"').replace(/<\/dialog>/gi, "</section>")
    .replace(/<details\b/gi, "<details open")
    .replace(/<link\b[^>]*>/gi, "")
    .replace(/<meta\b[^>]*http-equiv=(["']?)refresh\1[^>]*>/gi, "");
}

/** Neutralizes endpoint strings that survive attribute stripping (inline JSON, text). */
export function neutralizeProposalEndpoints(html: string): string {
  return html
    .replace(/\/api\/proposal\/track/gi, "/api/proposal/[removed]")
    .replace(/\/api\/proposal/gi, "/api/[removed]")
    .replace(/payment-intent/gi, "[removed]")
    .replace(/checkout\/session/gi, "[removed]")
    .replace(/stripe\.com|paypal\.com|clarity\.ms/gi, "[removed]");
}

export function decodeAcceptedCopyHtml(copy: Pick<AcceptedProposalCopy, "encoding" | "html">): string {
  if (copy.encoding !== "gzip+base64") throw new Error("Unknown accepted-copy encoding.");
  return gunzipSync(Buffer.from(copy.html, "base64")).toString("utf8");
}

export function readAcceptedCopy(onboardingData: unknown): AcceptedProposalCopy | null {
  const copy = asRecord(asRecord(onboardingData).acceptedProposalCopy);
  if (copy.version !== 2 || copy.encoding !== "gzip+base64" || typeof copy.html !== "string"
    || typeof copy.sha256 !== "string" || typeof copy.savedAt !== "string" || typeof copy.quoteId !== "string") return null;
  try {
    if (createHash("sha256").update(decodeAcceptedCopyHtml(copy as AcceptedProposalCopy), "utf8").digest("hex") !== copy.sha256) return null;
  } catch {
    return null;
  }
  return copy as AcceptedProposalCopy;
}

function readSelectionFromEngagement(engagement: { onboardingData: unknown }): Record<string, unknown> {
  const accepted = readAcceptedSelection(engagement.onboardingData);
  const data = asRecord(engagement.onboardingData);
  const services = Object.keys(accepted.services).length ? accepted.services
    : asRecord(asRecord(data.proposalBuilderState).services);
  const bookkeeping = accepted.bookkeeping ?? parseStoredProposalCheckout(services);
  const hourly = accepted.hourly ?? parseStoredHourlyCheckout(services.hourlyCheckout);
  const selection = bookkeeping ?? hourly;
  if (!selection) throw new Error("Stored accepted selection is missing; review before saving a copy.");
  return JSON.parse(JSON.stringify(selection)) as Record<string, unknown>;
}

export type ProposalCopyMarkers = {
  /** Client/company names from the quote's own data; at least one must appear. */
  identity: Array<string | null | undefined>;
  /** Selected tier/plan labels from the quote's own data; at least one must appear. */
  plan: Array<string | null | undefined>;
};

/** Short machine-readable reason for a failed copy save. Never a token or URL. */
export type AcceptedCopyErrorReason = "no-verified-domain" | "validation-failed" | "fetch-failed";

export type AcceptedCopyLastError = { at: string; reason: AcceptedCopyErrorReason };

const ACCEPTED_COPY_ERROR_REASONS: readonly AcceptedCopyErrorReason[] =
  ["no-verified-domain", "validation-failed", "fetch-failed"];

/** Staff-visible record of the last failed copy save (`acceptedProposalCopyLastError`). */
export function readAcceptedCopyLastError(onboardingData: unknown): AcceptedCopyLastError | null {
  const record = asRecord(asRecord(onboardingData).acceptedProposalCopyLastError);
  if (typeof record.at !== "string" || typeof record.reason !== "string") return null;
  if (!(ACCEPTED_COPY_ERROR_REASONS as readonly string[]).includes(record.reason)) return null;
  return { at: record.at, reason: record.reason as AcceptedCopyErrorReason };
}

function copyFailure(quoteId: string, reason: AcceptedCopyErrorReason): Error {
  const error = new Error(`Accepted copy fetch failed for quote ${quoteId}.`);
  (error as Error & { copyReason?: AcceptedCopyErrorReason }).copyReason = reason;
  return error;
}

/** Maps a save failure to its staff-visible reason code (default: fetch failed). */
export function acceptedCopyErrorReason(error: unknown): AcceptedCopyErrorReason {
  const tagged = (error as { copyReason?: unknown } | null)?.copyReason;
  if (typeof tagged === "string" && (ACCEPTED_COPY_ERROR_REASONS as readonly string[]).includes(tagged)) {
    return tagged as AcceptedCopyErrorReason;
  }
  if (error instanceof Error && error.message.includes("no verified proposal host")) return "no-verified-domain";
  return "fetch-failed";
}

/**
 * Records why the last copy save failed on the engagement JSON. Atomic patch
 * touching only `acceptedProposalCopyLastError` — never the saved copy,
 * `updatedAt`, Quote or status. A successful save clears the key (see
 * saveAcceptedCopy). Only short reason codes are stored, so no token or URL
 * is ever written here.
 */
export async function recordAcceptedCopyError(input: {
  brandId: string;
  engagementId: string;
  reason: AcceptedCopyErrorReason;
  at?: Date;
}): Promise<void> {
  const errorDoc: AcceptedCopyLastError = { at: (input.at ?? new Date()).toISOString(), reason: input.reason };
  await prisma.$executeRaw`
    UPDATE "Engagement"
    SET "onboardingData" = jsonb_set(COALESCE(NULLIF("onboardingData", 'null'::jsonb), '{}'::jsonb), '{acceptedProposalCopyLastError}', ${JSON.stringify(errorDoc)}::jsonb, true)
    WHERE id = ${input.engagementId} AND "brandId" = ${input.brandId}
  `;
}

/**
 * The self-fetch origin is the brand's own public host — the same verified
 * APP domain the app uses for public links — never a request-derived Host or
 * X-Forwarded-Host. A caller-supplied (request-derived) origin is honored
 * only when its host is on the brand's allowlist, otherwise refused.
 *
 * Preview deployments resolve to the production primary host (they share the
 * brand's verified domains), whose database has no preview token — so the
 * self-fetch 404s and fails closed, and previews therefore never archive a
 * copy. The failure is recorded as `acceptedProposalCopyLastError` for staff.
 */
export async function resolveBrandProposalOrigin(brandId: string): Promise<{ origin: string; allowedHosts: string[] }> {
  const domains = await prisma.brandDomain.findMany({
    where: { brandId, purpose: DomainPurpose.APP, status: DomainStatus.VERIFIED },
    select: { hostname: true, isPrimary: true },
    orderBy: [{ isPrimary: "desc" }, { hostname: "asc" }],
  });
  const allowedHosts = [...new Set(
    domains.map((domain) => normalizeHostname(domain.hostname)).filter((host): host is string => Boolean(host)),
  )];
  const primary = allowedHosts[0];
  if (!primary) throw new Error(`Brand ${brandId} has no verified proposal host.`);
  const local = primary === "localhost" || primary === "127.0.0.1";
  const origin = local && process.env.NODE_ENV !== "production"
    ? `http://${primary}:${process.env.PORT?.trim() || "3000"}`
    : `https://${primary}`;
  return { origin, allowedHosts };
}

function isAllowedProposalHost(hostname: string | null | undefined, allowedHosts: string[]): boolean {
  const host = normalizeHostname(hostname ?? null);
  return Boolean(host) && allowedHosts.some((allowed) => normalizeHostname(allowed) === host);
}

/** Resolves a caller-supplied (possibly request-derived) origin against the brand allowlist. */
export function resolveAllowedCopyOrigin(origin: string, allowedHosts: string[], quoteId: string): string {
  let host: string | null = null;
  try {
    host = new URL(origin).hostname;
  } catch {
    host = null;
  }
  if (!isAllowedProposalHost(host, allowedHosts)) {
    throw copyFailure(quoteId, "validation-failed");
  }
  return origin;
}

/**
 * The final URL (after redirects) must be the proposal itself on an allowed
 * host — never a login/protection page. An empty final URL means a
 * non-network Response (unit-test harness), which carries no redirect risk.
 */
export function assertFetchedProposalUrl(
  responseUrl: string | null | undefined,
  input: { allowedHosts: string[]; token: string; quoteId: string },
): void {
  if (!responseUrl) return;
  let finalUrl: URL;
  try {
    finalUrl = new URL(responseUrl);
  } catch {
    throw copyFailure(input.quoteId, "validation-failed");
  }
  if (!isAllowedProposalHost(finalUrl.hostname, input.allowedHosts)) {
    throw copyFailure(input.quoteId, "validation-failed");
  }
  const segments = finalUrl.pathname.split("/").filter(Boolean);
  let token: string | null = null;
  try {
    token = segments.length === 2 && segments[0] === "proposal" ? decodeURIComponent(segments[1]) : null;
  } catch {
    token = null;
  }
  if (token !== input.token) {
    throw copyFailure(input.quoteId, "validation-failed");
  }
}

/**
 * Decodes the HTML entities a React page emits for marker text (`&amp;`,
 * `&lt;`, `&gt;`, `&quot;`, `&#39;`/`&apos;`, `&#x27;` and numeric `&#NNN;`)
 * so raw quote data ("Smith & Sons", "O'Brien") matches its escaped rendering.
 * `&amp;` is decoded first so double-escaped sequences resolve in one pass.
 */
export function decodeMarkerEntities(text: string): string {
  let decoded = text;
  for (let pass = 0; pass < 3; pass += 1) {
    const next = decoded
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&apos;/gi, "'")
      .replace(/&#x([0-9a-f]+);/gi, (_all, hex: string) => {
        const code = Number.parseInt(hex, 16);
        return Number.isSafeInteger(code) && code <= 0x10FFFF ? String.fromCodePoint(code) : _all;
      })
      .replace(/&#(\d+);/g, (_all, digits: string) => {
        const code = Number.parseInt(digits, 10);
        return Number.isSafeInteger(code) && code <= 0x10FFFF ? String.fromCodePoint(code) : _all;
      });
    if (next === decoded) return next;
    decoded = next;
  }
  return decoded;
}

/**
 * The fetched HTML must contain proposal-specific markers from the quote's
 * own data (client/company name and the selected tier/plan label). A login,
 * protection, error or wrong-brand page never contains both, so it fails
 * closed here and nothing is stored. Comparison is against the entity-decoded
 * page with whitespace collapsed, because React escapes `&`/`'`/`<` in names
 * and markup whitespace never matches the stored data exactly.
 */
export function assertProposalContentMarkers(
  pageHtml: string,
  markers: ProposalCopyMarkers,
  quoteId: string,
): void {
  const clean = (values: Array<string | null | undefined>) =>
    values
      .map((value) => decodeMarkerEntities(value ?? "").replace(/\s+/g, " ").trim().toLowerCase())
      .filter((value): value is string => Boolean(value && value.length >= 2));
  const identity = clean(markers.identity);
  const plan = clean(markers.plan);
  const body = decodeMarkerEntities(pageHtml).replace(/\s+/g, " ").toLowerCase();
  if (identity.length === 0 || plan.length === 0) {
    throw copyFailure(quoteId, "validation-failed");
  }
  if (!identity.some((marker) => body.includes(marker)) || !plan.some((marker) => body.includes(marker))) {
    throw copyFailure(quoteId, "validation-failed");
  }
}

type AssetBudget = { remaining: number };

function assetDataUri(mime: string, bytes: Uint8Array): string {
  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}

async function fetchCappedAsset(
  assetUrl: string,
  fetchImpl: AcceptedCopyFetch,
  budget: AssetBudget,
): Promise<{ mime: string; bytes: Uint8Array } | null> {
  let response: Response;
  try {
    response = await fetchImpl(assetUrl, {
      headers: { Cookie: `${INTERNAL_VIEWER_COOKIE}=1` },
      signal: AbortSignal.timeout(COPY_FETCH_TIMEOUT_MS),
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  const mime = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await response.arrayBuffer());
  } catch {
    return null;
  }
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_COPY_ASSET_BYTES || bytes.byteLength > budget.remaining) return null;
  budget.remaining -= bytes.byteLength;
  return { mime, bytes };
}

function sameOriginAssetUrl(rawSrc: string, origin: string, allowedHosts: string[]): string | null {
  const src = rawSrc.trim();
  if (!src || src.startsWith("data:") || src.startsWith("blob:")) return null;
  let parsed: URL;
  try {
    parsed = new URL(src, origin);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (!isAllowedProposalHost(parsed.hostname, allowedHosts)) return null;
  return parsed.toString();
}

const FONT_MIME_BY_EXTENSION: Record<string, string> = {
  woff2: "font/woff2",
  woff: "font/woff",
  ttf: "font/ttf",
  otf: "font/otf",
};

function fontMimeFor(assetUrl: string, responseMime: string): string | null {
  if (/^font\//.test(responseMime) || responseMime === "application/font-woff" || responseMime === "application/font-sfnt") {
    return responseMime;
  }
  const extension = assetUrl.split("?", 1)[0].split("#", 1)[0].split(".").pop()?.toLowerCase() ?? "";
  return FONT_MIME_BY_EXTENSION[extension] ?? null;
}

/**
 * Embeds same-origin images as data URIs (capped per asset and in total);
 * cross-origin, oversized or failed images stay for the sanitizer to turn
 * into labeled placeholders.
 */
export async function embedSameOriginImages(
  pageHtml: string,
  input: { origin: string; allowedHosts: string[]; fetchImpl: AcceptedCopyFetch; budget: AssetBudget },
): Promise<{ html: string; images: number; skipped: number }> {
  let images = 0;
  let skipped = 0;
  const parts: string[] = [];
  const tagPattern = /<img\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  let cursor = 0;
  while ((match = tagPattern.exec(pageHtml)) !== null) {
    const tag = match[0];
    const src = tag.match(/\bsrc=(["'])(.*?)\1/i)?.[2] ?? tag.match(/\bsrc=([^\s>]+)/i)?.[2] ?? "";
    const assetUrl = sameOriginAssetUrl(src, input.origin, input.allowedHosts);
    if (!assetUrl) {
      continue;
    }
    const fetched = await fetchCappedAsset(assetUrl, input.fetchImpl, input.budget);
    if (!fetched || !/^image\//.test(fetched.mime)) {
      skipped += 1;
      continue;
    }
    const uri = assetDataUri(fetched.mime, fetched.bytes);
    if (uri.length > 350_000) {
      skipped += 1;
      continue;
    }
    parts.push(pageHtml.slice(cursor, match.index));
    parts.push(tag.replace(/\bsrc=(["'])(.*?)\1/i, `src=$1${uri}$1`));
    cursor = match.index + tag.length;
    images += 1;
  }
  parts.push(pageHtml.slice(cursor));
  return { html: parts.join(""), images, skipped };
}

/**
 * Embeds same-origin font files referenced by the inlined CSS as data URIs
 * within the same caps; anything else keeps the existing system-fallback
 * behavior (sanitized to `none`).
 */
export async function embedSameOriginFonts(
  css: string,
  input: { origin: string; allowedHosts: string[]; fetchImpl: AcceptedCopyFetch; budget: AssetBudget },
): Promise<{ css: string; fonts: number; skipped: number }> {
  let fonts = 0;
  let skipped = 0;
  const replacements: Array<{ original: string; replacement: string }> = [];
  for (const match of css.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi)) {
    const [original, , rawUrl] = match;
    if (/^data:/i.test(rawUrl)) continue;
    if (replacements.some((entry) => entry.original === original)) continue;
    const assetUrl = sameOriginAssetUrl(rawUrl, input.origin, input.allowedHosts);
    if (!assetUrl) continue;
    const fetched = await fetchCappedAsset(assetUrl, input.fetchImpl, input.budget);
    const mime = fetched ? fontMimeFor(assetUrl, fetched.mime) : null;
    if (!fetched || !mime) {
      skipped += 1;
      replacements.push({ original, replacement: "none" });
      continue;
    }
    replacements.push({ original, replacement: `url("${assetDataUri(mime, fetched.bytes)}")` });
    fonts += 1;
  }
  let embedded = css;
  for (const { original, replacement } of replacements) {
    embedded = embedded.split(original).join(replacement);
  }
  return { css: embedded, fonts, skipped };
}

export async function fetchAndBuildAcceptedCopy(input: {
  origin: string;
  token: string;
  quoteId: string;
  source: "accept" | "backfill";
  selection: Record<string, unknown>;
  fetchImpl?: AcceptedCopyFetch;
  savedAt?: Date;
  allowedHosts?: string[];
  expectedMarkers?: ProposalCopyMarkers;
}): Promise<AcceptedProposalCopy> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const allowedHosts = input.allowedHosts?.length
    ? input.allowedHosts
    : (() => {
      try {
        return [new URL(input.origin).hostname];
      } catch {
        return [];
      }
    })();
  const sourceUrlPath = `/proposal/${input.token}`;
  const url = proposalCopyUrl(input.origin, input.token);
  // The ?internal=1 marker + internal cookie are honored SERVER-side by the
  // page (searchParams + cookie) and by /api/proposal/track (cookie), so this
  // fetch records no client view, activity or status change. No page JS runs
  // here, so no tracking request is ever issued.
  let pageHtml: string;
  let responseUrl: string | null = null;
  try {
    const response = await fetchImpl(url, {
      headers: { Cookie: `${INTERNAL_VIEWER_COOKIE}=1`, Accept: "text/html" },
      signal: AbortSignal.timeout(COPY_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Proposal page answered ${response.status}.`);
    responseUrl = typeof response.url === "string" ? response.url : null;
    pageHtml = await response.text();
  } catch {
    // Fetch failures (and timeouts) expose the request URL, which carries the
    // token: never let them propagate. Logs carry the quote id only.
    throw copyFailure(input.quoteId, "fetch-failed");
  }
  if (!pageHtml || pageHtml.length > MAX_COPY_HTML_BYTES || !/<(main|body|div)\b/i.test(pageHtml)) {
    throw copyFailure(input.quoteId, "validation-failed");
  }
  // Fail closed: the fetched page must actually be this proposal on an
  // allowed host, and must contain the quote's own markers.
  assertFetchedProposalUrl(responseUrl, { allowedHosts, token: input.token, quoteId: input.quoteId });
  if (input.expectedMarkers) {
    assertProposalContentMarkers(pageHtml, input.expectedMarkers, input.quoteId);
  }

  const hrefs = extractStylesheetHrefs(pageHtml).filter((href) => {
    try {
      return new URL(href, input.origin).origin === new URL(input.origin).origin;
    } catch {
      return false;
    }
  });
  const budget: AssetBudget = { remaining: MAX_COPY_ASSETS_TOTAL_BYTES };
  const embeddedImages = await embedSameOriginImages(pageHtml, {
    origin: input.origin, allowedHosts, fetchImpl, budget,
  });
  const cssParts: string[] = [];
  let cssInlined = hrefs.length > 0;
  let fontsEmbedded = 0;
  let fontsSkipped = 0;
  for (const href of hrefs) {
    try {
      const cssUrl = new URL(href, input.origin).toString();
      const cssResponse = await fetchImpl(cssUrl, {
        headers: { Cookie: `${INTERNAL_VIEWER_COOKIE}=1`, Accept: "text/css" },
        signal: AbortSignal.timeout(COPY_FETCH_TIMEOUT_MS),
      });
      if (!cssResponse.ok) throw new Error(`CSS answered ${cssResponse.status}.`);
      const embedded = await embedSameOriginFonts(await cssResponse.text(), {
        origin: input.origin, allowedHosts, fetchImpl, budget,
      });
      fontsEmbedded += embedded.fonts;
      fontsSkipped += embedded.skipped;
      cssParts.push(sanitizeCss(embedded.css));
    } catch {
      cssInlined = false;
    }
  }

  const savedAt = (input.savedAt ?? new Date()).toISOString();
  const clean = neutralizeProposalEndpoints(sanitizeFetchedProposalHtml(embeddedImages.html));
  const css = cssParts.join("\n");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<meta http-equiv="Content-Security-Policy" content="${ACCEPTED_COPY_CSP}"><title>Saved accepted proposal</title>`
    + `<style>${css}</style></head><body><aside><h1>Saved copy of the accepted proposal — ${escapeArchiveText(savedAt)} — staff only</h1>`
    + `<p>Frozen capture of the public proposal page as served to the client.</p></aside>${clean}</body></html>`;
  const sha256 = createHash("sha256").update(html, "utf8").digest("hex");
  return {
    version: 2,
    encoding: "gzip+base64",
    html: gzipSync(Buffer.from(html, "utf8")).toString("base64"),
    sha256,
    savedAt,
    gitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    source: input.source,
    quoteId: input.quoteId,
    sourceUrlPath,
    cssInlined,
    assetsInlined: {
      images: embeddedImages.images,
      fonts: fontsEmbedded,
      skipped: embeddedImages.skipped + fontsSkipped,
    },
    selection: input.selection,
  };
}

/** Atomic set-if-absent JSON patch; deliberately leaves Engagement.updatedAt
 * (agreement optimistic lock), every other engagement field, and Quote untouched.
 */
export async function saveAcceptedCopy(input: {
  brandId: string;
  quoteId?: string;
  engagementId?: string;
  source: "accept" | "backfill";
  origin?: string;
  fetchImpl?: AcceptedCopyFetch;
}): Promise<void> {
  const quote = await prisma.quote.findFirst({
    where: { brandId: input.brandId, ...(input.quoteId ? { id: input.quoteId } : { engagementId: input.engagementId }) },
    select: {
      id: true, status: true, publicToken: true,
      client: { select: { name: true, company: true } },
      engagement: {
        select: {
          id: true, brandId: true, status: true, signedAt: true,
          onboardingFeeStatus: true, onboardingData: true,
        },
      },
    },
  });
  if (!quote || !quote.engagement || quote.engagement.brandId !== input.brandId) throw new Error("Offer not found.");
  if (!isQuoteFrozen(quote)) throw new Error("Only accepted, signed or paid offers can have an accepted copy.");
  const data = asRecord(quote.engagement.onboardingData);
  // Even an unrecognised future format must never be overwritten.
  if (Object.hasOwn(data, "acceptedProposalCopy")) return;
  const token = quote.publicToken;
  if (!token) throw new Error("Offer not found.");
  const selection = readSelectionFromEngagement(quote.engagement);
  let copy: AcceptedProposalCopy;
  try {
    // Origin comes from the brand's own verified APP domains — the same hosts
    // the app uses for public proposal links — never from request headers.
    // (On preview deployments this is the production host, whose DB has no
    // preview token: the self-fetch then fails closed and only the error key
    // below is written — previews never archive a copy.)
    const { origin: brandOrigin, allowedHosts } = await resolveBrandProposalOrigin(input.brandId);
    const origin = input.origin ? resolveAllowedCopyOrigin(input.origin, allowedHosts, quote.id) : brandOrigin;
    const accepted = readAcceptedSelection(quote.engagement.onboardingData);
    copy = await fetchAndBuildAcceptedCopy({
      origin, token, quoteId: quote.id, source: input.source, selection, fetchImpl: input.fetchImpl,
      allowedHosts,
      expectedMarkers: {
        identity: [quote.client?.company, quote.client?.name],
        plan: [accepted.bookkeeping?.tierLabel, accepted.hourly?.catalogItemLabel],
      },
    });
  } catch (error) {
    // A failed accept-time or backfill save must stay visible to staff on the
    // offer page (reason code only — never the token or URL). The error write
    // itself must not mask the original failure.
    await recordAcceptedCopyError({
      brandId: input.brandId, engagementId: quote.engagement.id, reason: acceptedCopyErrorReason(error),
    }).catch(() => {});
    throw error;
  }
  await prisma.$executeRaw`
    UPDATE "Engagement"
    SET "onboardingData" = (jsonb_set(COALESCE(NULLIF("onboardingData", 'null'::jsonb), '{}'::jsonb), '{acceptedProposalCopy}', ${JSON.stringify(copy)}::jsonb, true) - 'acceptedProposalCopyLastError')
    WHERE id = ${quote.engagement.id} AND "brandId" = ${input.brandId}
      AND NOT (COALESCE("onboardingData", '{}'::jsonb) ? 'acceptedProposalCopy')
  `;
}
