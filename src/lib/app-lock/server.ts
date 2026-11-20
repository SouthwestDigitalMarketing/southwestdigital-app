import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { pinChangeDue } from "./reminder";
import { RESET_COOKIE, RESET_MINUTES, UNLOCK_COOKIE, UNLOCK_HOURS, resetAllowed, signReset, signUnlock, unlockIsValid } from "./token";

function secret(): string {
  const value = process.env.AUTH_SECRET?.trim();
  if (!value) throw new Error("AUTH_SECRET is required for the app lock");
  return value;
}

export type AppLockState = {
  hasPin: boolean;
  pinChangedAt: Date | null;
  unlocked: boolean;
  /** Monthly PIN change is due (shown as a banner, does not block). */
  changeDue: boolean;
};

/** Once per request: whether this signed-in user has unlocked this device. */
export const getAppLockState = cache(async (userId: string): Promise<AppLockState> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pinHash: true, pinChangedAt: true },
  });
  const pinChangedAt = user?.pinChangedAt ?? null;
  const hasPin = Boolean(user?.pinHash && pinChangedAt);
  const jar = await cookies();
  const now = Date.now();
  const unlocked =
    hasPin && unlockIsValid(jar.get(UNLOCK_COOKIE)?.value, userId, pinChangedAt!.getTime(), now, secret());
  return { hasPin, pinChangedAt, unlocked, changeDue: pinChangeDue(pinChangedAt, new Date(now)) };
});

/** Path and query of the current request, set by src/proxy.ts. */
async function currentPath(): Promise<string> {
  const value = (await headers()).get("x-pathname") ?? "/dashboard";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

/** Staff screens call this (via requireAppBrand); sends a locked device to /unlock. */
export async function requireUnlocked(userId: string): Promise<AppLockState> {
  const state = await getAppLockState(userId);
  if (!state.unlocked) redirect(`/unlock?next=${encodeURIComponent(await currentPath())}`);
  return state;
}

export async function setUnlockCookie(userId: string, pinChangedAt: Date) {
  const jar = await cookies();
  jar.set(UNLOCK_COOKIE, signUnlock(userId, pinChangedAt.getTime(), Date.now(), secret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: UNLOCK_HOURS * 3600,
  });
}

export async function clearUnlockCookie() {
  (await cookies()).delete(UNLOCK_COOKIE);
}

/** The WebAuthn relying party for this request: the hostname and full origin. */
export async function relyingParty(): Promise<{ rpId: string; origin: string }> {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim();
  const proto = (h.get("x-forwarded-proto") ?? "https").split(",")[0].trim();
  return { rpId: host.replace(/:\d+$/, ""), origin: `${proto}://${host}` };
}

export async function startPinReset(userId: string) {
  (await cookies()).set(RESET_COOKIE, signReset(userId, Date.now(), secret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: RESET_MINUTES * 60,
  });
}

/** True when this session may set a new PIN without the old one (see resetAllowed). */
export async function pinResetAllowed(userId: string, signedInAt: number): Promise<boolean> {
  return resetAllowed((await cookies()).get(RESET_COOKIE)?.value, userId, signedInAt, Date.now(), secret());
}

export async function clearPinReset() {
  (await cookies()).delete(RESET_COOKIE);
}

export { secret as appLockSecret };
