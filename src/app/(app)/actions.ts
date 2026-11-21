"use server";

import { signOut } from "@/auth";
import { clearUnlockCookie } from "@/lib/app-lock/server";

export async function signOutAction() {
  await clearUnlockCookie();
  await signOut({ redirectTo: "/login" });
}
