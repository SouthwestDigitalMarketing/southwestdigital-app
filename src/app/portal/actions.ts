"use server";

import { signOut } from "@/auth";

export async function signOutOfPortal() {
  await signOut({ redirectTo: "/login" });
}

