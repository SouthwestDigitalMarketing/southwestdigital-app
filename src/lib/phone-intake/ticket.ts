import { createHmac, timingSafeEqual } from "crypto";

/** A 2 GB phone video still fits. Three billion bytes is the cap. */
export const PHONE_INTAKE_MAX_BYTES = 3_000_000_000;
/** Long enough for a big file on a slow phone link. */
export const PHONE_INTAKE_TTL_SECONDS = 3 * 60 * 60;

export function safeFileName(raw: string): string {
  const base = raw.split(/[/\\]/).pop() ?? "";
  const clean = base.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return (clean || "upload.bin").slice(0, 120);
}

export function ticketMessage(exp: number, size: number, name: string): string {
  return `${exp}\n${size}\n${name}`;
}

export function signTicket(secret: string, exp: number, size: number, name: string): string {
  return createHmac("sha256", secret).update(ticketMessage(exp, size, name)).digest("hex");
}

export function ticketMatches(
  secret: string,
  exp: number,
  size: number,
  name: string,
  sig: string,
): boolean {
  const expected = signTicket(secret, exp, size, name);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function signSession(secret: string, exp: number): string {
  return createHmac("sha256", secret).update(`session\n${exp}`).digest("hex");
}

/**
 * Signed link to ripley's send page. The phone opens it as a plain link, so
 * the HTTPS site never makes an HTTP request (no mixed-content block) and the
 * phone PUTs straight to ripley over the tailnet.
 */
export function sendPageLink(input: {
  secret: string;
  publicUrl: string;
  nowSeconds: number;
}): { ok: true; url: string; exp: number } | { ok: false; error: string } {
  if (!input.secret || !input.publicUrl) {
    return { ok: false, error: "The send road is not set up on this server." };
  }
  let origin: URL;
  try {
    origin = new URL(input.publicUrl);
  } catch {
    return { ok: false, error: "The send road address is not a valid link." };
  }
  if (origin.protocol !== "http:" && origin.protocol !== "https:") {
    return { ok: false, error: "The send road address is not a valid link." };
  }
  const exp = input.nowSeconds + PHONE_INTAKE_TTL_SECONDS;
  const url = new URL("/send", origin);
  url.searchParams.set("exp", String(exp));
  url.searchParams.set("sig", signSession(input.secret, exp));
  return { ok: true, url: url.toString(), exp };
}
