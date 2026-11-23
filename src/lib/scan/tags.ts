import type { EngagementStatus, PrismaClient } from "@prisma/client";
import { ContactTagKind } from "@prisma/client";
import { applyPipeTag } from "@/lib/pipe/tags";
import { PIPE_PROSPECTS_KEY } from "@/lib/pipe/deals";
import { postScanFinding } from "@/lib/scanner/post";
import type { ScanChange } from "./scan";

/**
 * Tags-are-the-engine (sop-sales-tag-actions): every scan makes each
 * contact's tags and stage match the evidence.
 *
 * Clear-cut with proof -> fixed here and listed. Judgment calls -> filed as
 * scanner findings for Tom to approve, never changed. Money and contract
 * tags (paid, contract-signed, won) only ever land on proof; a client saying
 * "Done." is a flag, never a tag.
 */
export type TagEvidenceResult = { changes: ScanChange[]; fixed: number; judgments: number };

const PAID_STATUSES: EngagementStatus[] = ["DEPOSIT_PAID", "ONBOARDING_PAID"];
const TERMINAL_STAGES = ["won", "lost"];
const STALE_LEAD_DAYS = 21;
const MAX_PER_RULE = 10;

type Brand = { id: string; slug: string };

function emailsOf(engagement: { primaryContactEmail: string | null; billingContactEmail: string | null }): string[] {
  return [engagement.primaryContactEmail, engagement.billingContactEmail]
    .map((email) => email?.trim().toLowerCase())
    .filter((email): email is string => !!email && email.includes("@"));
}

async function contactsByEmail(
  db: PrismaClient,
  brandId: string,
  emails: string[],
): Promise<Map<string, { id: string; name: string; email: string | null }>> {
  if (emails.length === 0) return new Map();
  const rows = await db.contact.findMany({
    where: { brandId, email: { in: [...new Set(emails)] } },
    select: { id: true, name: true, email: true },
  });
  const found = new Map<string, { id: string; name: string; email: string | null }>();
  for (const row of rows) {
    if (row.email) found.set(row.email.toLowerCase(), row);
  }
  // The store may keep mixed case; match case-insensitively.
  if (found.size < new Set(emails).size) {
    const lowered = new Set(emails.map((email) => email.toLowerCase()));
    const extra = await db.contact.findMany({
      where: { brandId, email: { not: null } },
      select: { id: true, name: true, email: true },
    });
    for (const row of extra) {
      if (row.email && lowered.has(row.email.toLowerCase()) && !found.has(row.email.toLowerCase())) {
        found.set(row.email.toLowerCase(), row);
      }
    }
  }
  return found;
}

async function heldTags(db: PrismaClient, contactId: string): Promise<Set<string>> {
  const links = await db.contactTagLink.findMany({
    where: { contactId },
    select: { tag: { select: { key: true } } },
  });
  return new Set(links.map((link) => link.tag.key));
}

async function fileJudgment(args: {
  db: PrismaClient;
  actorUserId: string;
  brand: Brand;
  room: "pipeline" | "payments" | "contracts";
  key: string;
  what: string;
  evidence: string;
}): Promise<void> {
  await postScanFinding({
    brandId: args.brand.id,
    actorUserId: args.actorUserId,
    input: {
      brand: args.brand.slug,
      room: args.room,
      key: args.key,
      what: args.what,
      severity: "normal",
      evidence: args.evidence,
      fixLevel: 2,
      role: "sales-pipeline",
      presence: "open",
      doneNote: null,
    },
  });
}

async function moveOpenDealsToWon(
  db: PrismaClient,
  brandId: string,
  contactId: string,
): Promise<number> {
  const pipeline = await db.pipeline.findFirst({
    where: { brandId, key: PIPE_PROSPECTS_KEY },
    select: { id: true },
  });
  if (!pipeline) return 0;
  const stages = await db.pipelineStage.findMany({
    where: { pipelineId: pipeline.id },
    select: { id: true, key: true },
  });
  const wonId = stages.find((stage) => stage.key === "won")?.id;
  if (!wonId) return 0;
  const links = await db.leadContact.findMany({ where: { brandId, contactId }, select: { leadId: true } });
  if (links.length === 0) return 0;
  const items = await db.pipelineItem.findMany({
    where: {
      pipelineId: pipeline.id,
      leadId: { in: links.map((link) => link.leadId) },
      isActive: true,
    },
    select: { id: true, stage: { select: { key: true } } },
  });
  const open = items.filter((item) => !TERMINAL_STAGES.includes(item.stage.key));
  for (const item of open) {
    await db.pipelineItem.update({ where: { id: item.id }, data: { stageId: wonId, isActive: true } });
  }
  return open.length;
}

export async function applyTagEvidence(args: {
  db: PrismaClient;
  actorUserId: string;
  brands: Brand[];
  since: Date | null;
}): Promise<TagEvidenceResult> {
  const { db, actorUserId, brands } = args;
  const floor = args.since ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const changes: ScanChange[] = [];
  let fixed = 0;
  let judgments = 0;

  for (const brand of brands) {
    const [signed, paid] = await Promise.all([
      db.engagement.findMany({
        where: { brandId: brand.id, status: "SIGNED", updatedAt: { gte: floor } },
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: { id: true, clientName: true, primaryContactEmail: true, billingContactEmail: true, updatedAt: true },
      }),
      db.engagement.findMany({
        where: { brandId: brand.id, status: { in: PAID_STATUSES }, updatedAt: { gte: floor } },
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: { id: true, clientName: true, primaryContactEmail: true, billingContactEmail: true, updatedAt: true, status: true },
      }),
    ]);

    const contacts = await contactsByEmail(db, brand.id, [
      ...signed.flatMap(emailsOf),
      ...paid.flatMap(emailsOf),
    ]);

    for (const engagement of signed) {
      const who = engagement.clientName || "A client";
      const contact = emailsOf(engagement).map((email) => contacts.get(email)).find(Boolean);
      if (!contact) {
        await fileJudgment({
          db, actorUserId, brand, room: "pipeline", key: `scan-tags:no-contact:${engagement.id}`,
          what: `No contact card for ${who} — signed ${engagement.updatedAt.toISOString().slice(0, 10)}. Create the card?`,
          evidence: `Engagement ${engagement.id} SIGNED; no Contact matches ${emailsOf(engagement).join(", ") || "no email"}.`,
        });
        judgments += 1;
        continue;
      }
      const result = await applyPipeTag({
        actorUserId,
        input: { brand: brand.slug, contactId: contact.id, tag: "contract-signed", action: "add", kind: ContactTagKind.STATUS },
      });
      if (result.changed) {
        fixed += 1;
        changes.push({ kind: "swapp", text: `${who}: contract signed` });
      }
    }

    for (const engagement of paid) {
      const who = engagement.clientName || "A client";
      const contact = emailsOf(engagement).map((email) => contacts.get(email)).find(Boolean);
      if (!contact) {
        await fileJudgment({
          db, actorUserId, brand, room: "payments", key: `scan-tags:no-contact:${engagement.id}`,
          what: `No contact card for ${who} — deposit paid ${engagement.updatedAt.toISOString().slice(0, 10)}. Create the card?`,
          evidence: `Engagement ${engagement.id} ${engagement.status}; no Contact matches ${emailsOf(engagement).join(", ") || "no email"}.`,
        });
        judgments += 1;
        continue;
      }
      const paidTag = await applyPipeTag({
        actorUserId,
        input: { brand: brand.slug, contactId: contact.id, tag: "paid", action: "add", kind: ContactTagKind.STATUS },
      });
      const signedTag = await applyPipeTag({
        actorUserId,
        input: { brand: brand.slug, contactId: contact.id, tag: "contract-signed", action: "add", kind: ContactTagKind.STATUS },
      });
      if (paidTag.changed || signedTag.changed) {
        fixed += 1;
        const moved = await moveOpenDealsToWon(db, brand.id, contact.id);
        changes.push({ kind: "swapp", text: moved > 0 ? `${who}: proposed → won` : `${who}: proposed → paid` });
      }
    }

    // Stale leads: open for 21+ days with no movement. Never auto-archived.
    const staleCutoff = new Date(Date.now() - STALE_LEAD_DAYS * 24 * 60 * 60 * 1000);
    const stale = await db.lead.findMany({
      where: { brandId: brand.id, status: { in: ["NEW", "CONTACTED"] }, createdAt: { lt: staleCutoff } },
      orderBy: { createdAt: "asc" },
      take: MAX_PER_RULE,
      select: { id: true, name: true, company: true, email: true, status: true, createdAt: true },
    });
    for (const lead of stale) {
      await fileJudgment({
        db, actorUserId, brand, room: "pipeline", key: `scan-tags:stale-lead:${lead.id}`,
        what: `Stale lead ${lead.name}${lead.company ? ` (${lead.company})` : ""} — no movement since ${lead.createdAt.toISOString().slice(0, 10)}. Advance or archive?`,
        evidence: `Lead ${lead.id} status ${lead.status} since ${lead.createdAt.toISOString()}; email ${lead.email ?? "-"}.`,
      });
      judgments += 1;
    }
    if (stale.length > 0) {
      changes.push({ kind: "swapp", text: `${stale.length} stale lead${stale.length === 1 ? "" : "s"} need${stale.length === 1 ? "s" : ""} your call` });
    }

    // Won deals must carry both money tags; a won stage without proof is a judgment call.
    const pipeline = await db.pipeline.findFirst({ where: { brandId: brand.id, key: PIPE_PROSPECTS_KEY }, select: { id: true } });
    if (pipeline) {
      const wonItems = await db.pipelineItem.findMany({
        where: { pipelineId: pipeline.id, isActive: true, stage: { key: "won" } },
        take: MAX_PER_RULE,
        select: {
          lead: { select: { id: true, name: true, contacts: { select: { contactId: true } } } },
        },
      });
      for (const item of wonItems) {
        for (const link of item.lead.contacts) {
          const tags = await heldTags(db, link.contactId);
          const missing = ["contract-signed", "paid"].filter((tag) => !tags.has(tag));
          if (missing.length > 0) {
            const contact = await db.contact.findUnique({ where: { id: link.contactId }, select: { name: true } });
            await fileJudgment({
              db, actorUserId, brand, room: "payments", key: `scan-tags:won-no-proof:${item.lead.id}`,
              what: `${item.lead.name}: marked won but missing ${missing.join(" + ")} — verify before it counts.`,
              evidence: `Deal ${item.lead.id} sits in won; contact ${contact?.name ?? link.contactId} holds [${[...tags].join(", ") || "no tags"}].`,
            });
            judgments += 1;
            break;
          }
        }
      }
    }

    // `paid` tag with no payment proof anywhere: audit, don't auto-remove money tags.
    const paidLinks = await db.contactTagLink.findMany({
      where: { tag: { brandId: brand.id, key: "paid" } },
      take: MAX_PER_RULE * 5,
      select: { contact: { select: { id: true, name: true, email: true } } },
    });
    if (paidLinks.length > 0) {
      const paidEngagements = await db.engagement.findMany({
        where: { brandId: brand.id, status: { in: PAID_STATUSES } },
        take: 200,
        select: { primaryContactEmail: true, billingContactEmail: true },
      });
      const proofEmails = new Set(paidEngagements.flatMap(emailsOf));
      for (const link of paidLinks.slice(0, MAX_PER_RULE)) {
        const email = link.contact.email?.toLowerCase();
        if (!email || proofEmails.has(email)) continue;
        await fileJudgment({
          db, actorUserId, brand, room: "payments", key: `scan-tags:paid-no-proof:${link.contact.id}`,
          what: `${link.contact.name}: holds the paid tag with no payment on file — verify or remove?`,
          evidence: `Contact ${link.contact.id} (${email}) tagged paid; no DEPOSIT_PAID/ONBOARDING_PAID engagement matches.`,
        });
        judgments += 1;
      }
    }

    // `lead` tag stays till no open deal is left: nothing open -> remove it.
    const leadLinks = await db.contactTagLink.findMany({
      where: { tag: { brandId: brand.id, key: "lead" } },
      take: MAX_PER_RULE * 5,
      select: { contact: { select: { id: true, name: true, email: true } } },
    });
    for (const link of leadLinks.slice(0, MAX_PER_RULE)) {
      const contactId = link.contact.id;
      const dealLinks = await db.leadContact.findMany({ where: { brandId: brand.id, contactId }, select: { leadId: true } });
      let open = false;
      if (dealLinks.length > 0 && pipeline) {
        const items = await db.pipelineItem.findMany({
          where: { pipelineId: pipeline.id, leadId: { in: dealLinks.map((l) => l.leadId) }, isActive: true },
          select: { stage: { select: { key: true } } },
        });
        open = items.some((item) => !TERMINAL_STAGES.includes(item.stage.key));
      }
      if (!open && link.contact.email) {
        const rows = await db.lead.findMany({
          where: { brandId: brand.id, normalizedEmail: link.contact.email.toLowerCase(), status: { in: ["NEW", "CONTACTED"] } },
          select: { id: true },
          take: 1,
        });
        open = rows.length > 0;
      }
      if (open) continue;
      const result = await applyPipeTag({
        actorUserId,
        input: { brand: brand.slug, contactId, tag: "lead", action: "remove" },
      });
      if (result.changed) {
        fixed += 1;
        changes.push({ kind: "swapp", text: `${link.contact.name}: lead tag removed (nothing open)` });
      }
    }
  }

  return { changes, fixed, judgments };
}
