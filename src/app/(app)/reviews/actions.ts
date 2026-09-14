"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { ReviewChannel } from "@prisma/client";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { sendSms } from "@/lib/quo";
import { getQuoSmsCredentials } from "@/lib/reviews/quoCredentials";
import { resolvePublicReviewOrigin } from "@/lib/reviews/publicOrigin";

const NAME_MAX = 80;
const DAILY_SMS_CAP = 30;
const SAME_PHONE_WINDOW_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function countBrandSmsToday(brandId: string) {
  const since = startOfUtcDay();
  const [created, reminded] = await Promise.all([
    prisma.reviewRequest.count({ where: { brandId, sentAt: { gte: since } } }),
    prisma.reviewRequest.count({ where: { brandId, lastReminderAt: { gte: since } } }),
  ]);
  return created + reminded;
}

async function assertDailySmsCap(brandId: string) {
  const sentToday = await countBrandSmsToday(brandId);
  if (sentToday >= DAILY_SMS_CAP) {
    throw new Error("This brand has reached the daily SMS review-request limit.");
  }
}

function hasSmsConsent(formData: FormData) {
  const value = formData.get("smsConsent");
  return value === "on" || value === "true" || value === "yes";
}

export async function sendReviewRequest(formData: FormData) {
  const { brand, membership } = await requireStaffBrandOrThrow();
  if (!membership) throw new Error("No brand access");

  const recipientName = (formData.get("recipientName") as string | null)?.trim() ?? "";
  const rawPhone = (formData.get("recipientPhone") as string | null)?.trim() ?? "";

  if (!recipientName || !rawPhone) throw new Error("Name and phone are required");
  if (recipientName.length > NAME_MAX) throw new Error("Name must be 80 characters or fewer.");
  if (!hasSmsConsent(formData)) throw new Error("Confirm you have permission to text this number.");

  const recipientPhone = normalizePhone(rawPhone);

  const since24h = new Date(Date.now() - SAME_PHONE_WINDOW_MS);
  const recentSamePhone = await prisma.reviewRequest.findFirst({
    where: { brandId: brand.id, recipientPhone, sentAt: { gte: since24h } },
    select: { id: true },
  });
  if (recentSamePhone) {
    throw new Error("A review request was already sent to this number in the last 24 hours.");
  }

  await assertDailySmsCap(brand.id);

  const origin = await resolvePublicReviewOrigin(brand.id);
  const credentials = await getQuoSmsCredentials(brand.id);
  const token = randomBytes(16).toString("hex");
  const link = `${origin}/r/${token}`;
  const firstName = recipientName.split(" ")[0];

  await sendSms(
    recipientPhone,
    `Hi ${firstName}! We appreciate your business with ${brand.name}. Would you mind sharing a quick review? It only takes 30 seconds: ${link}`,
    credentials,
  );

  try {
    await prisma.reviewRequest.create({
      data: {
        brandId: brand.id,
        token,
        channel: ReviewChannel.SMS,
        recipientName,
        recipientPhone,
        sentByMembershipId: membership.id,
      },
    });
  } catch {
    throw new Error("The text was sent but the request was not saved. Do not retry until this is checked.");
  }

  revalidatePath("/reviews");
}

export async function sendReminder(requestId: string) {
  const { brand, membership } = await requireStaffBrandOrThrow();
  if (!membership) throw new Error("No brand access");

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
  if (request.channel !== ReviewChannel.SMS || !request.recipientPhone) {
    throw new Error("Reminders can only be sent by SMS to a saved phone number.");
  }

  await assertDailySmsCap(brand.id);

  const origin = await resolvePublicReviewOrigin(brand.id);
  const credentials = await getQuoSmsCredentials(brand.id);
  const link = `${origin}/r/${request.token}`;
  const firstName = (request.recipientName ?? "").split(" ")[0] || "there";

  await sendSms(
    normalizePhone(request.recipientPhone),
    `Hi ${firstName}! Just a quick reminder — we'd love a review from you! It only takes 30 seconds: ${link}`,
    credentials,
  );

  await prisma.reviewRequest.update({
    where: { id: requestId },
    data: { lastReminderAt: new Date() },
  });

  revalidatePath("/reviews");
}
