"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveBrand } from "@/lib/brands/resolve";
import { sendSms } from "@/lib/quo";
import { ReviewChannel } from "@prisma/client";
import { normalizePhone } from "@/lib/phone";

export async function sendReviewRequest(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const recipientName = (formData.get("recipientName") as string | null)?.trim() ?? "";
  const rawPhone = (formData.get("recipientPhone") as string | null)?.trim() ?? "";

  if (!recipientName || !rawPhone) throw new Error("Name and phone are required");

  const recipientPhone = normalizePhone(rawPhone);

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

export async function sendReminder(requestId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const headersList = await headers();
  const resolved = await resolveBrand(headersList.get("x-hostname"), session.user.id);
  if (!resolved?.membership) throw new Error("No brand access");

  const { brand } = resolved;

  const request = await prisma.reviewRequest.findUnique({
    where: { id: requestId },
    select: {
      brandId: true,
      token: true,
      channel: true,
      recipientPhone: true,
      recipientName: true,
    },
  });

  if (!request || request.brandId !== brand.id) throw new Error("Not found");

  const baseUrl = (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const link = `${baseUrl}/r/${request.token}`;
  const firstName = (request.recipientName ?? "").split(" ")[0] || "there";

  if (request.channel === ReviewChannel.SMS && request.recipientPhone) {
    await sendSms(
      normalizePhone(request.recipientPhone),
      `Hi ${firstName}! Just a quick reminder — we'd love a review from you! It only takes 30 seconds: ${link}`,
    );
  }

  await prisma.reviewRequest.update({
    where: { id: requestId },
    data: { lastReminderAt: new Date() },
  });

  revalidatePath("/reviews");
}
