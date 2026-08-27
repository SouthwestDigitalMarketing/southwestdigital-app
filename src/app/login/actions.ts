"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authProviderAvailability, signIn } from "@/auth";
import { normalizeEmail } from "@/lib/email/normalize";

const emailSchema = z.string().trim().email().max(320);

export async function requestMagicLink(formData: FormData) {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) redirect("/login?error=InvalidEmail");

  const providerId = authProviderAvailability.emailProviderId;
  if (!providerId) redirect("/login?error=Configuration");

  try {
    await signIn(providerId, {
      email: normalizeEmail(parsed.data),
      redirectTo: "/auth/complete",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      if (providerId === "dev-bypass") {
        redirect("/login?error=AccessDenied");
      }
      // Do not reveal whether an email address has a platform invitation.
      redirect("/login/check-email");
    }
    throw error;
  }
}

