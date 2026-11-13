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

export type IntakePlan =
  | { ok: true; putUrl: string; name: string; exp: number; sig: string }
  | { ok: false; status: number; error: string };

export function planIntake(input: {
  name: unknown;
  size: unknown;
  type: unknown;
  secret: string;
  publicUrl: string;
  nowSeconds: number;
}): IntakePlan {
  if (!input.secret || !input.publicUrl) {
    return { ok: false, status: 503, error: "The send road is not set up on this server." };
  }
  let uploadOrigin: URL;
  try {
    uploadOrigin = new URL(input.publicUrl);
  } catch {
    return { ok: false, status: 503, error: "The send road address is not a valid link." };
  }
  if (uploadOrigin.protocol !== "http:" && uploadOrigin.protocol !== "https:") {
    return { ok: false, status: 503, error: "The send road address is not a valid link." };
  }

  const name = typeof input.name === "string" ? safeFileName(input.name) : "";
  if (!name) return { ok: false, status: 400, error: "That file needs a name." };

  const size = input.size;
  if (typeof size !== "number" || !Number.isInteger(size) || size < 1) {
    return { ok: false, status: 400, error: "That file is empty." };
  }
  if (size > PHONE_INTAKE_MAX_BYTES) {
    return { ok: false, status: 400, error: "That file is over 3 GB. Pick a smaller one." };
  }

  if (typeof input.type === "string" && input.type.length > 0) {
    const kind = input.type.split(";")[0]?.trim().toLowerCase() ?? "";
    if (!kind.startsWith("video/") && !kind.startsWith("image/")) {
      return { ok: false, status: 400, error: "Pick a video or a picture." };
    }
  }

  const exp = input.nowSeconds + PHONE_INTAKE_TTL_SECONDS;
  const sig = signTicket(input.secret, exp, size, name);
  const put = new URL("/upload", uploadOrigin);
  put.searchParams.set("exp", String(exp));
  put.searchParams.set("size", String(size));
  put.searchParams.set("name", name);
  put.searchParams.set("sig", sig);
  return { ok: true, putUrl: put.toString(), name, exp, sig };
}
