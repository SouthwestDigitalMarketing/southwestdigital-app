"use server";

import { headers } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveBrand } from "@/lib/brands/resolve";
import { sendSms } from "@/lib/quo";
import { ReviewChannel } from "@prisma/client";

export async function sendReviewRequest(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const recipientName = (formData.get("recipientName") as string | null)?.trim() ?? "";
  const recipientPhone = (formData.get("recipientPhone") as string | null)?.trim() ?? "";

  if (!recipientName || !recipientPhone) throw new Error("Name and phone are required");

  const headersList = await headers();
  const hostname = headersList.get("x-hostname");
  const resolved = await resolveBrand(hostname, session.user.id);
  if (!resolved?.membership) throw new Error("No brand access");

  const { brand, membership } = resolved;

  const request = await prisma.reviewRequest.create({
    data: {
      brandId: brand.id,
      channel: ReviewChannel.SMS,
      recipientName,
      recipientPhone,
      sentByMembershipId: membership.id,
    },
    select: { token: true },
  });

  const baseUrl = (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const link = `${baseUrl}/r/${request.token}`;
  const firstName = recipientName.split(" ")[0];

  await sendSms(
    recipientPhone,
    `Hi ${firstName}! We appreciate your business with ${brand.name}. Would you mind sharing a quick review? It only takes 30 seconds: ${link}`,
  );
}
