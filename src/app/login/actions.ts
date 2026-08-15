"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn } from "@/auth";
import { normalizeEmail } from "@/lib/email/normalize";

const emailSchema = z.string().trim().email().max(320);

export async function signInWithGoogle() {
  try {
    await signIn("google", { redirectTo: "/auth/complete" });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=AccessDenied");
    }
    throw error;
  }
}

export async function requestMagicLink(formData: FormData) {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) redirect("/login?error=InvalidEmail");

  try {
    await signIn("resend", {
      email: normalizeEmail(parsed.data),
      redirectTo: "/auth/complete",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // Do not reveal whether an email address has a platform invitation.
      redirect("/login/check-email");
    }
    throw error;
  }
}

