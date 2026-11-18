import "server-only";

import { ContactTagKind, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { applyPipeTag } from "@/lib/pipe/tags";
import { upsertPipeContact } from "@/lib/pipe/contacts";
import { PIPE_PROSPECTS_KEY } from "@/lib/pipe/deals";
import { createBrandDataContext, withBrandDataTransaction } from "@/lib/tenancy/context";
import { firmDateKey } from "./schedule";

/**
 * Runs when a client pays a signed proposal (live payments only). Every
 * system learns the client was won, so nobody has to tell a tool by hand
 * (All Thing concepts/vision-one-man-100k § Sharpened):
 *
 * 1. the engagement becomes the service record (type, pricing, fee) and is
 *    linked to the client's contact (concepts/service-records-design);
 * 2. the contact gets the client tags (concepts/client-lifecycle-tags),
 *    which also starts the Reviews pipeline;
 * 3. open Pipe Prospects deals move to won, and `lead` comes off;
 * 4. the client joins Operations in the onboarding stage.
 *
 * Each step is idempotent and reported, not thrown: payment is already
 * recorded, so a failed step shows as a failed "Client set up in our
 * systems" duty on the Operations screen instead of breaking the webhook.
 */

export type ClientWonResult = { done: string[]; failed: string[]; clientKey: string | null };

type Selection = { recurringMonthlyTotal?: unknown; selectedTierLabel?: unknown };
type Acceptance = {
  signer?: { name?: unknown; email?: unknown };
  payment?: { status?: unknown; paidAt?: unknown };
  selection?: Selection;
  signedAt?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export function clientKeyFor(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80)
      .replace(/-+$/, "") || "client"
  );
}

/** The client tags a paid monthly (or one-time) proposal earns. */
export function clientTagsFor(monthly: boolean): { key: string; kind: ContactTagKind }[] {
  return [
    { key: "contract-signed", kind: ContactTagKind.CUSTOM },
    { key: "paid", kind: ContactTagKind.STATUS },
    { key: "active-client", kind: ContactTagKind.STATUS },
    ...(monthly
      ? [
          { key: "monthly-bookkeeping", kind: ContactTagKind.SERVICES },
          { key: "service-monthly-bookkeeping-active", kind: ContactTagKind.CUSTOM },
        ]
      : []),
    { key: "review-pending", kind: ContactTagKind.CUSTOM },
  ];
}

export async function onClientWon(engagementId: string, brandId: string): Promise<ClientWonResult> {
  const done: string[] = [];
  const failed: string[] = [];
  const step = async (label: string, run: () => Promise<string | void>) => {
    try {
      const note = await run();
      done.push(note ? `${label} (${note})` : label);
    } catch (error) {
      failed.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const engagement = await prisma.engagement.findFirst({
    where: { id: engagementId, brandId },
    select: {
      id: true,
      clientName: true,
      clientLegalName: true,
      primaryContactName: true,
      primaryContactEmail: true,
      primaryContactPhone: true,
      engagementType: true,
      pricingModel: true,
      feeAmount: true,
      contactId: true,
      onboardingData: true,
    },
  });
  if (!engagement) return { done, failed: ["engagement not found"], clientKey: null };
  const data = isRecord(engagement.onboardingData) ? engagement.onboardingData : {};
  const acceptance = (isRecord(data.proposalAcceptance) ? data.proposalAcceptance : {}) as Acceptance;
  if (acceptance.payment?.status !== "paid") return { done, failed: ["not paid"], clientKey: null };

  const paidAt = new Date(text(acceptance.payment?.paidAt) || Date.now());
  const signedAt = text(acceptance.signedAt) ? new Date(text(acceptance.signedAt)) : null;
  const monthlyFee = Number(acceptance.selection?.recurringMonthlyTotal ?? 0);
  const monthly = Number.isFinite(monthlyFee) && monthlyFee > 0;
  const clientName = engagement.clientLegalName || engagement.clientName || "Client";
  const email = engagement.primaryContactEmail || text(acceptance.signer?.email);
  const personName = engagement.primaryContactName || text(acceptance.signer?.name) || clientName;
  const actorUserId = process.env.PIPE_API_ACTOR_USER_ID?.trim() ?? "";
  const brandSlug = (await prisma.brand.findUniqueOrThrow({ where: { id: brandId }, select: { slug: true } })).slug;
  const context = createBrandDataContext({ brandId, actorUserId });

  // 1. Service record.
  await step("Service record filled", async () => {
    const fill: Prisma.EngagementUpdateInput = {};
    if (monthly && !engagement.engagementType) fill.engagementType = "MONTHLY_BOOKKEEPING";
    if (monthly && !engagement.pricingModel) fill.pricingModel = "MONTHLY_RECURRING";
    if (monthly && engagement.feeAmount === null) fill.feeAmount = new Prisma.Decimal(monthlyFee);
    if (Object.keys(fill).length) await prisma.engagement.update({ where: { id: engagement.id }, data: fill });
    return monthly ? `monthly $${monthlyFee}` : "not monthly";
  });

  // 2. Contact: the existing one with this email, or a new one.
  let contactId = engagement.contactId;
  await step("Contact linked", async () => {
    if (!actorUserId) throw new Error("PIPE_API_ACTOR_USER_ID is not set");
    if (!contactId && email) {
      const found = await withBrandDataTransaction(context, (tx) =>
        tx.contact.findMany({
          where: { brandId, isActive: true, email: { equals: email, mode: "insensitive" } },
          select: { id: true, leadLinks: { select: { id: true } } },
          orderBy: { createdAt: "asc" },
        }),
      );
      // Prefer the contact already on a deal; otherwise the oldest.
      contactId = (found.find((c) => c.leadLinks.length > 0) ?? found[0])?.id ?? null;
    }
    let created = false;
    if (!contactId) {
      const result = await upsertPipeContact({
        actorUserId,
        input: { brand: brandSlug, name: personName, email: email || null, phone: engagement.primaryContactPhone, company: clientName },
      });
      if (!("contact" in result) || !result.contact) throw new Error("could not create the contact");
      contactId = result.contact.id;
      created = true;
    }
    await prisma.engagement.update({ where: { id: engagement.id }, data: { contactId } });
    return created ? "new contact" : undefined;
  });

  // 3. Client tags (Reviews pipeline starts from review-pending).
  if (contactId) {
    await step("Client tags added", async () => {
      for (const tag of clientTagsFor(monthly)) {
        await applyPipeTag({
          actorUserId,
          input: { brand: brandSlug, contactId: contactId!, tag: tag.key, action: "add", kind: tag.kind },
        });
      }
    });

    // 4. Open deals to won; then `lead` comes off.
    await step("Deal marked won", async () => {
      const moved = await withBrandDataTransaction(context, async (tx) => {
        const pipeline = await tx.pipeline.findUnique({
          where: { brandId_key: { brandId, key: PIPE_PROSPECTS_KEY } },
          select: { id: true, stages: { select: { id: true, key: true } } },
        });
        const won = pipeline?.stages.find((s) => s.key === "won");
        if (!pipeline || !won) return 0;
        const open = await tx.pipelineItem.findMany({
          where: {
            pipelineId: pipeline.id,
            isActive: true,
            stage: { key: { notIn: ["won", "lost"] } },
            lead: { brandId, contacts: { some: { contactId: contactId! } } },
          },
          select: { id: true, leadId: true },
        });
        for (const item of open) {
          await tx.pipelineItem.update({ where: { id: item.id }, data: { stageId: won.id } });
          await tx.meetingLead.update({
            where: { id: item.leadId },
            data: { firstPaymentReceivedAt: paidAt, ...(signedAt ? { serviceAgreementSignedAt: signedAt } : {}) },
          });
        }
        return open.length;
      });
      await applyPipeTag({
        actorUserId,
        input: { brand: brandSlug, contactId: contactId!, tag: "lead", action: "remove" },
      });
      return `${moved} deal${moved === 1 ? "" : "s"} moved`;
    });
  }

  // 5. Operations roster, onboarding stage.
  let clientKey: string | null = null;
  await step("Added to Operations (onboarding)", async () => {
    const wonOn = new Date(`${firmDateKey(paidAt)}T00:00:00Z`);
    const linked = await prisma.operationsClient.findUnique({ where: { engagementId: engagement.id } });
    const key = linked?.key ?? clientKeyFor(clientName);
    const sameKey = linked ? null : await prisma.operationsClient.findUnique({ where: { brandId_key: { brandId, key } } });
    const existing = linked ?? sameKey;
    if (existing) {
      // Already enrolled (by hand or an earlier run): link it, and move it to
      // onboarding only if it has not started the monthly routine.
      await prisma.operationsClient.update({
        where: { id: existing.id },
        data: {
          engagementId: engagement.id,
          active: true,
          ...(existing.stage === "active" && existing.engagementId ? {} : { stage: "onboarding", wonOn }),
        },
      });
    } else {
      await prisma.operationsClient.create({
        data: { brandId, key, name: clientName, stage: "onboarding", wonOn, startsOn: wonOn, engagementId: engagement.id },
      });
    }
    clientKey = key;
    return key;
  });

  // Report on the first onboarding duty, so a failure shows on the screen.
  if (clientKey) {
    const client = await prisma.operationsClient.findUnique({
      where: { brandId_key: { brandId, key: clientKey } },
      select: { id: true, wonOn: true, stage: true },
    });
    if (client?.wonOn && client.stage === "onboarding") {
      const summary = failed.length
        ? `Failed: ${failed.join("; ")}. Done: ${done.join("; ") || "nothing"}`
        : `Done: ${done.join("; ")}`;
      await prisma.operationsEvidence
        .create({
          data: {
            brandId,
            dutyId: "onboarding-records",
            operationsClientId: client.id,
            period: client.wonOn,
            status: failed.length ? "failed" : "done",
            summary: summary.slice(0, 1000),
            sourceRef: `engagement ${engagement.id}`,
            reportedBy: "swapp",
            sourceEventId: `client-won:${engagement.id}:${failed.length ? `failed:${Date.now()}` : "done"}`,
            occurredAt: new Date(),
          },
        })
        .catch((error: unknown) => {
          // A repeat run that succeeded again is already recorded.
          if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
        });
    }
  }

  return { done, failed, clientKey };
}
