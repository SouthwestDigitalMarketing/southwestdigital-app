"use server";

import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { afterFailedPin, hashPin, pinProblem, verifyPin } from "@/lib/app-lock/pin";
import { clearPinReset, pinResetAllowed, setUnlockCookie, startPinReset } from "@/lib/app-lock/server";

export type UnlockFormState = { error: string | null };

/** Only same-site paths; anything else goes to the dashboard. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/unlock") ? next : "/dashboard";
}

async function signedInUser(): Promise<{ id: string; signedInAt: number }> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return { id: session.user.id, signedInAt: session.user.signedInAt ?? 0 };
}

async function signedInUserId(): Promise<string> {
  return (await signedInUser()).id;
}

function minutesLeft(until: Date, now: Date) {
  return Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 60_000));
}

export async function unlockWithPin(_prev: UnlockFormState, form: FormData): Promise<UnlockFormState> {
  const userId = await signedInUserId();
  const pin = String(form.get("pin") ?? "");
  const now = new Date();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pinHash: true, pinChangedAt: true, pinFailedCount: true, pinLockedUntil: true },
  });
  if (!user?.pinHash || !user.pinChangedAt) redirect("/unlock");
  if (user.pinLockedUntil && user.pinLockedUntil > now) {
    return { error: `Too many wrong PINs. Try again in ${minutesLeft(user.pinLockedUntil, now)} minutes.` };
  }

  if (!(await verifyPin(pin, user.pinHash))) {
    const next = afterFailedPin(user.pinFailedCount, now);
    await prisma.user.update({
      where: { id: userId },
      data: { pinFailedCount: next.failedCount, pinLockedUntil: next.lockedUntil },
    });
    return {
      error: next.lockedUntil
        ? `Too many wrong PINs. Try again in ${minutesLeft(next.lockedUntil, now)} minutes.`
        : "Wrong PIN.",
    };
  }

  await prisma.user.update({ where: { id: userId }, data: { pinFailedCount: 0, pinLockedUntil: null } });
  await setUnlockCookie(userId, user.pinChangedAt);
  redirect(safeNext(form.get("next")));
}

/** "Forgot PIN?": sign out; after signing in again the unlock screen offers a new PIN. */
export async function forgotPin() {
  await startPinReset(await signedInUserId());
  await signOut({ redirectTo: "/login" });
}

/** First PIN for this account, or a new one after "Forgot PIN?" and a fresh sign-in. */
export async function createPin(_prev: UnlockFormState, form: FormData): Promise<UnlockFormState> {
  const { id: userId, signedInAt } = await signedInUser();
  const pin = String(form.get("pin") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  const problem = pinProblem(pin);
  if (problem) return { error: problem };
  if (pin !== confirm) return { error: "The two PINs do not match." };

  const changedAt = new Date();
  const resetting = await pinResetAllowed(userId, signedInAt);
  const updated = await prisma.user.updateMany({
    where: resetting ? { id: userId } : { id: userId, pinHash: null },
    data: { pinHash: await hashPin(pin), pinChangedAt: changedAt, pinFailedCount: 0, pinLockedUntil: null },
  });
  if (updated.count === 0) return { error: "A PIN is already set. Enter it to unlock." };
  if (resetting) await clearPinReset();
  await setUnlockCookie(userId, changedAt);
  redirect("/settings/security?new=1");
}
