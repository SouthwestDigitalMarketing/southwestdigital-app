"use server";

import { revalidatePath } from "next/cache";
import { requireAppBrand } from "@/lib/brands/staff";
import { prisma } from "@/lib/prisma";
import { hashPin, pinProblem, verifyPin } from "@/lib/app-lock/pin";
import { setUnlockCookie } from "@/lib/app-lock/server";

export type SecurityFormState = { error: string | null; done: string | null };

export async function changePin(_prev: SecurityFormState, form: FormData): Promise<SecurityFormState> {
  const { session } = await requireAppBrand();
  const current = String(form.get("current") ?? "");
  const pin = String(form.get("pin") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { pinHash: true } });
  if (!user?.pinHash || !(await verifyPin(current, user.pinHash))) {
    return { error: "Your current PIN is not right.", done: null };
  }
  const problem = pinProblem(pin);
  if (problem) return { error: problem, done: null };
  if (pin !== confirm) return { error: "The two new PINs do not match.", done: null };
  if (pin === current) return { error: "Choose a different PIN from the current one.", done: null };

  const changedAt = new Date();
  await prisma.user.update({
    where: { id: session.user.id },
    data: { pinHash: await hashPin(pin), pinChangedAt: changedAt, pinFailedCount: 0, pinLockedUntil: null },
  });
  // Changing the PIN ends the unlock on every other device; keep this one open.
  await setUnlockCookie(session.user.id, changedAt);
  revalidatePath("/", "layout");
  return { error: null, done: "PIN changed. Other devices will ask for the new PIN." };
}

export async function removePasskey(form: FormData) {
  const { session } = await requireAppBrand();
  const id = String(form.get("id") ?? "");
  await prisma.userPasskey.deleteMany({ where: { id, userId: session.user.id } });
  revalidatePath("/settings/security");
}
