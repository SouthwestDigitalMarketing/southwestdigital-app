"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { sendSms } from "@/lib/quo";
import { ReviewChannel } from "@prisma/client";
import { normalizePhone } from "@/lib/phone";

export async function sendReviewRequest(formData: FormData) {
  const { brand, membership } = await requireStaffBrandOrThrow();
  if (!membership) throw new Error("No brand access");

  const recipientName = (formData.get("recipientName") as string | null)?.trim() ?? "";
  const rawPhone = (formData.get("recipientPhone") as string | null)?.trim() ?? "";

  if (!recipientName || !rawPhone) throw new Error("Name and phone are required");

  const recipientPhone = normalizePhone(rawPhone);

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
  const { brand } = await requireStaffBrandOrThrow();

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
