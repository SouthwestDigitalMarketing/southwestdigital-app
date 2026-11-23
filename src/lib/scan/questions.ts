import type { LeadStatus, Prisma, PrismaClient } from "@prisma/client";
import { PIPE_PROSPECTS_KEY } from "@/lib/pipe/deals";
import { applyPipeTag } from "@/lib/pipe/tags";
import { postScanFinding } from "@/lib/scanner/post";
import type { ScanRoleKey, ScanRoom } from "@/lib/scanner/vocab";

const roleOf = (role: string | null): ScanRoleKey =>
  role === "mail-desk" || role === "client-delivery" || role === "systems" ? role : "sales-pipeline";

export const MAX_OPEN_QUESTIONS = 5;

function kindForFindingKey(key: string): QuestionKind | null {
  if (key.startsWith("scan-cleanup:sms:")) return "sms-lead";
  if (key.startsWith("scan-cleanup:form:")) return "form-brand";
  if (key.startsWith("scan-tags:stale-lead:")) return "stale-lead";
  if (key.startsWith("scan-tags:paid-no-proof:")) return "paid-verify";
  if (key.startsWith("scan-tags:won-no-proof:")) return "won-verify";
  if (key.startsWith("scan-tags:no-contact:")) return "no-contact";
  return null;
}

function entityId(key: string): string {
  return key.slice(key.lastIndexOf(":") + 1);
}

/** Draw open review findings into tap-answer questions (max 5 open per
 * brand; the rest wait). Also retires questions whose finding closed. */
export async function syncQuestions(db: Db, brandIds: string[]): Promise<{ created: number; retired: number }> {
  let created = 0;
  let retired = 0;
  for (const brandId of brandIds) {
    const open = await db.scanQuestion.findMany({
      where: { brandId, status: "open" },
      select: { id: true, findingId: true },
    });
    for (const question of open) {
      if (!question.findingId) continue;
      const finding = await db.scanFinding.findUnique({
        where: { id: question.findingId },
        select: { state: true },
      });
      if (finding && finding.state !== "open") {
        await db.scanQuestion.update({ where: { id: question.id }, data: { status: "dismissed" } });
        retired += 1;
      }
    }
    const openCount = await db.scanQuestion.count({ where: { brandId, status: "open" } });
    if (openCount >= MAX_OPEN_QUESTIONS) continue;
    const askedFindingIds = (
      await db.scanQuestion.findMany({ where: { brandId }, select: { findingId: true } })
    )
      .map((row) => row.findingId)
      .filter((id): id is string => !!id);
    const candidates = await db.scanFinding.findMany({
      where: {
        brandId,
        state: "open",
        fixLevel: 2,
        OR: [{ key: { startsWith: "scan-tags:" } }, { key: { startsWith: "scan-cleanup:" } }],
        id: askedFindingIds.length > 0 ? { notIn: askedFindingIds } : undefined,
      },
      orderBy: [{ severity: "desc" }, { firstSeenAt: "asc" }],
      take: MAX_OPEN_QUESTIONS - openCount,
      select: { id: true, room: true, key: true, what: true, severity: true },
    });
    for (const finding of candidates) {
      const kind = kindForFindingKey(finding.key);
      if (!kind) continue;
      await db.scanQuestion.create({
        data: {
          brandId,
          kind,
          ref: { entityId: entityId(finding.key) },
          findingId: finding.id,
          what: finding.what,
          options: OPTIONS[kind],
          severity: finding.severity === "urgent" ? "urgent" : "normal",
        },
      });
      created += 1;
    }
  }
  return { created, retired };
}

export type ActiveRule = { kind: string; matcher: Record<string, unknown>; action: Record<string, unknown> | null };

/** Rules the poller consults, per brand. Small enough to fetch every run. */
export async function listActiveRules(db: Db, brandId: string): Promise<ActiveRule[]> {
  const rows = await db.scanRule.findMany({
    where: { brandId, active: true },
    select: { kind: true, matcher: true, action: true },
  });
  return rows.map((row) => ({
    kind: row.kind,
    matcher: (row.matcher ?? {}) as Record<string, unknown>,
    action: (row.action ?? null) as Record<string, unknown> | null,
  }));
}

/** After a few similar answers, propose one broader rule for a single yes/no.
 * v1 groups by sender domain for spam handling. One proposal per pattern:
 * a declined proposal blocks that pattern for good. */
export async function proposeBroaderRules(
  db: Db,
  brands: { id: string; slug: string }[],
): Promise<{ created: number }> {
  let created = 0;
  for (const brand of brands) {
    const rules = await db.scanRule.findMany({
      where: { brandId: brand.id, active: true, kind: { in: ["always-spam", "sms-ignore", "form-ignore"] } },
      select: { id: true, kind: true, matcher: true },
    });
    const groups = new Map<string, { kind: string; domain: string; ids: string[] }>();
    for (const rule of rules) {
      const matcher = (rule.matcher ?? {}) as Record<string, unknown>;
      const raw = typeof matcher.sender === "string" ? matcher.sender : typeof matcher.domain === "string" ? matcher.domain : "";
      const domain = raw.includes("@") ? raw.slice(raw.lastIndexOf("@") + 1).toLowerCase() : raw.toLowerCase();
      if (!domain || domain === "gmail.com" || domain === "outlook.com" || domain === "yahoo.com" || domain === "hotmail.com") continue;
      const key = `${rule.kind}:${domain}`;
      const group = groups.get(key) ?? { kind: rule.kind, domain, ids: [] };
      group.ids.push(rule.id);
      groups.set(key, group);
    }
    for (const group of groups.values()) {
      if (group.ids.length < 3) continue;
      const proposalKey = `scan-questions:broaden:${group.kind}:${group.domain}`;
      const existing = await db.scanQuestion.findFirst({
        where: { brandId: brand.id, kind: "broaden", status: { in: ["open", "answered"] } },
        select: { id: true, ref: true },
      });
      if (existing) {
        const ref = (existing.ref ?? {}) as Record<string, unknown>;
        if (ref.patternKey === proposalKey) continue;
      }
      const declined = await db.scanRule.findFirst({
        where: { brandId: brand.id, kind: "broaden-declined", active: true },
        select: { id: true, matcher: true },
      });
      if (declined) {
        const m = (declined.matcher ?? {}) as Record<string, unknown>;
        if (m.patternKey === proposalKey) continue;
      }
      const actionLabel =
        group.kind === "always-spam" ? `Always spam *@${group.domain}` : `Ignore *@${group.domain} in scans`;
      await db.scanQuestion.create({
        data: {
          brandId: brand.id,
          kind: "broaden",
          ref: { patternKey: proposalKey, ruleKind: group.kind, domain: group.domain, narrowIds: group.ids },
          findingId: null,
          what: `${group.ids.length} similar answers: ${actionLabel}?`,
          options: OPTIONS.broaden,
          severity: "normal",
        },
      });
      created += 1;
      if (created >= 1) break;
    }
    if (created >= 1) break;
  }
  return { created };
}

/**
 * SCAN PART 2 (Tom 2026-11-23): unsure items become tap-answer questions
 * (max 5); every answer is saved as a rule the scan applies next time.
 * Money, contracts, sends and permanent deletes are never automated and
 * never offered as options: those stay Tom's call in their own tools.
 */

export type QuestionOption = { key: string; label: string };

export type QuestionKind =
  | "sms-lead"
  | "form-brand"
  | "stale-lead"
  | "paid-verify"
  | "won-verify"
  | "no-contact"
  | "broaden";

const OPTIONS: Record<QuestionKind, QuestionOption[]> = {
  "sms-lead": [
    { key: "create-lead", label: "Create lead" },
    { key: "ignore", label: "Ignore" },
  ],
  "form-brand": [
    { key: "brand-bookkeeping-conroe", label: "Bookkeeping Conroe" },
    { key: "brand-real-estate-bookkeeper", label: "Real Estate Bookkeeper" },
    { key: "not-lead", label: "Not a lead" },
  ],
  "stale-lead": [
    { key: "keep", label: "Still working it" },
    { key: "archive", label: "Archive it" },
  ],
  "paid-verify": [
    { key: "confirmed", label: "Confirmed paid" },
    { key: "remove-tag", label: "Remove tag" },
  ],
  "won-verify": [
    { key: "confirmed", label: "Confirmed" },
    { key: "reopen", label: "Reopen deal" },
  ],
  "no-contact": [
    { key: "create", label: "Create card" },
    { key: "skip", label: "Skip" },
  ],
  broaden: [
    { key: "yes", label: "Yes, make it a rule" },
    { key: "no", label: "No" },
  ],
};

export const QUESTION_OPTIONS: Record<QuestionKind, QuestionOption[]> = OPTIONS;

export type UndoOp =
  | { op: "tag"; contactId: string; tag: string; added: boolean }
  | { op: "lead-status"; leadId: string; status: string }
  | { op: "contact-delete"; contactId: string }
  | { op: "rule-off"; ruleId: string }
  | { op: "finding-open"; findingId: string }
  | { op: "deal-stage"; leadId: string; stage: string }
  | { op: "none" };

type Db = PrismaClient;

async function closeFinding(db: Db, actorUserId: string, brandId: string, findingId: string, doneNote: string): Promise<void> {
  const finding = await db.scanFinding.findUnique({
    where: { id: findingId },
    select: { brandId: true, room: true, key: true, what: true, severity: true, roleKey: true },
  });
  if (!finding || finding.brandId !== brandId) return;
  await postScanFinding({
    brandId,
    actorUserId,
    input: {
      brand: "",
      room: finding.room as ScanRoom,
      key: finding.key,
      what: finding.what,
      severity: finding.severity === "urgent" ? "urgent" : "normal",
      evidence: "Closed from a tap answer.",
      fixLevel: 2,
      role: roleOf(finding.roleKey),
      presence: "gone",
      doneNote,
    },
  });
}

async function deactivateRule(db: Db, ruleId: string): Promise<void> {
  await db.scanRule.update({ where: { id: ruleId }, data: { active: false } }).catch(() => undefined);
}

async function reopenFinding(db: Db, actorUserId: string, brandId: string, findingId: string): Promise<void> {
  const finding = await db.scanFinding.findUnique({
    where: { id: findingId },
    select: { brandId: true, room: true, key: true, what: true, severity: true, roleKey: true },
  });
  if (!finding || finding.brandId !== brandId) return;
  await postScanFinding({
    brandId,
    actorUserId,
    input: {
      brand: "",
      room: finding.room as ScanRoom,
      key: finding.key,
      what: finding.what,
      severity: finding.severity === "urgent" ? "urgent" : "normal",
      evidence: "Reopened: tap answer undone.",
      fixLevel: 2,
      role: roleOf(finding.roleKey),
      presence: "open",
      doneNote: null,
    },
  });
}

type Ref = Record<string, unknown>;
const str = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text : null;
};

async function createRule(
  db: Db,
  brandId: string,
  kind: string,
  matcher: Record<string, unknown>,
  action: Record<string, unknown> | null,
  createdFrom: string,
) {
  return db.scanRule.create({
    data: {
      brandId,
      kind,
      matcher: matcher as Prisma.InputJsonValue,
      action: action as Prisma.InputJsonValue | undefined,
      createdFrom,
    },
  });
}

async function markAnswered(
  db: Db,
  questionId: string,
  answerKey: string,
  ruleId: string | null,
  undo: UndoOp[],
  doneNote: string,
  actorUserId: string,
  brandId: string,
  findingId: string | null,
): Promise<void> {
  await db.scanQuestion.update({
    where: { id: questionId },
    data: { status: "answered", answerKey, ruleId, undo: undo as unknown as object, answeredAt: new Date() },
  });
  if (findingId) await closeFinding(db, actorUserId, brandId, findingId, doneNote);
}

async function setDealStage(db: Db, brandId: string, leadId: string, stageKey: "won" | "proposed"): Promise<boolean> {
  const pipeline = await db.pipeline.findFirst({ where: { brandId, key: PIPE_PROSPECTS_KEY }, select: { id: true } });
  if (!pipeline) return false;
  const stages = await db.pipelineStage.findMany({ where: { pipelineId: pipeline.id }, select: { id: true, key: true } });
  const stageId = stages.find((stage) => stage.key === stageKey)?.id;
  if (!stageId) return false;
  const updated = await db.pipelineItem.updateMany({
    where: { pipelineId: pipeline.id, leadId, isActive: true, stage: { key: stageKey === "won" ? { not: "won" } : "won" } },
    data: { stageId, isActive: true },
  });
  return updated.count > 0;
}

/** Apply one tap answer. Returns a short human confirmation. Every action
 * records its own undo. */
export async function answerQuestion(
  db: Db,
  actorUserId: string,
  questionId: string,
  optionKey: string,
): Promise<{ message: string }> {
  const question = await db.scanQuestion.findUnique({ where: { id: questionId } });
  if (!question) throw new Error("Question not found.");
  if (question.status !== "open") return { message: "Already answered." };
  const options = (question.options ?? []) as QuestionOption[];
  if (!options.some((option) => option.key === optionKey)) throw new Error("Not an offered answer.");
  const ref = ((question.ref ?? {}) as Ref) ?? {};
  const done = async (message: string, ruleId: string | null, undo: UndoOp[], doneNote: string) => {
    await markAnswered(db, question.id, optionKey, ruleId, undo, doneNote, actorUserId, question.brandId, question.findingId);
    return { message };
  };

  switch (`${question.kind}:${optionKey}`) {
    case "sms-lead:create-lead": {
      const number = str(ref.number);
      if (!number) throw new Error("Missing number.");
      const existing = await db.lead.findFirst({
        where: { brandId: question.brandId, OR: [{ phoneE164: number }, { normalizedEmail: null, name: number }] },
        select: { id: true },
      });
      let leadId = existing?.id ?? null;
      if (!leadId) {
        const lead = await db.lead.create({
          data: {
            brandId: question.brandId, name: number, phoneE164: number, status: "NEW",
            source: "scan", sourceDetail: "sms question",
            notes: `Created from a tap answer. ${(str(ref.body) ?? "").slice(0, 200)}`,
          },
          select: { id: true },
        });
        leadId = lead.id;
      }
      const rule = await createRule(db, question.brandId, "sms-lead", { number }, { createLead: true }, question.id);
      const undo: UndoOp[] = leadId && !existing ? [{ op: "lead-status", leadId, status: "ARCHIVED" }] : [{ op: "none" }];
      (undo as UndoOp[]).push({ op: "rule-off", ruleId: rule.id });
      return done(`Lead created for ${number}; future texts come in on their own.`, rule.id, undo, "Answered: lead created.");
    }
    case "sms-lead:ignore": {
      const number = str(ref.number);
      if (!number) throw new Error("Missing number.");
      const rule = await createRule(db, question.brandId, "sms-ignore", { number }, null, question.id);
      return done("Ignored — future texts from this number stay out of the way.", rule.id, [{ op: "rule-off", ruleId: rule.id }], "Answered: ignored.");
    }
    case "form-brand:brand-bookkeeping-conroe":
    case "form-brand:brand-real-estate-bookkeeper": {
      const slug = optionKey === "form-brand:brand-bookkeeping-conroe" ? "bookkeeping-conroe" : "real-estate-bookkeeper";
      const email = str(ref.email)?.toLowerCase() ?? null;
      const brandRow = await db.brand.findUnique({ where: { slug }, select: { id: true } });
      if (!brandRow) throw new Error("Unknown brand.");
      const dup = email
        ? await db.lead.findFirst({ where: { brandId: brandRow.id, normalizedEmail: email }, select: { id: true } })
        : null;
      let leadId = dup?.id ?? null;
      if (!leadId) {
        const lead = await db.lead.create({
          data: {
            brandId: brandRow.id, name: str(ref.name) ?? email ?? "Website visitor",
            company: str(ref.company), email, normalizedEmail: email,
            phoneE164: str(ref.phone), status: "NEW", source: "scan",
            sourceDetail: `form:${str(ref.form) ?? "website"} (tap answer)`,
            notes: `Filed from a tap answer for ${str(ref.domain) ?? "the website"}.`,
          },
          select: { id: true },
        });
        leadId = lead.id;
      }
      const rule = await createRule(db, brandRow.id, "form-brand", { domain: str(ref.domain) ?? "" }, { brand: slug }, question.id);
      const undo: UndoOp[] = leadId && !dup ? [{ op: "lead-status", leadId, status: "ARCHIVED" }] : [{ op: "none" }];
      undo.push({ op: "rule-off", ruleId: rule.id });
      return done(`Filed under ${slug === "bookkeeping-conroe" ? "Bookkeeping Conroe" : "The Real Estate Bookkeeper"}; next time it files itself.`, rule.id, undo, "Answered: filed.");
    }
    case "form-brand:not-lead": {
      const rule = await createRule(db, question.brandId, "form-ignore", { domain: str(ref.domain) ?? "" }, null, question.id);
      return done("Not a lead — future forms from there stay out of the way.", rule.id, [{ op: "rule-off", ruleId: rule.id }], "Answered: not a lead.");
    }
    case "stale-lead:keep": {
      const leadId = str(ref.leadId ?? ref.entityId);
      if (!leadId) throw new Error("Missing lead.");
      const rule = await createRule(db, question.brandId, "stale-keep", { leadId }, null, question.id);
      return done("Kept — the scan stops nagging about this one.", rule.id, [{ op: "rule-off", ruleId: rule.id }], "Answered: still working it.");
    }
    case "stale-lead:archive": {
      const leadId = str(ref.leadId ?? ref.entityId);
      if (!leadId) throw new Error("Missing lead.");
      const lead = await db.lead.findUnique({ where: { id: leadId }, select: { status: true, brandId: true } });
      if (!lead || lead.brandId !== question.brandId) throw new Error("Lead not found.");
      await db.lead.update({ where: { id: leadId }, data: { status: "ARCHIVED" } });
      return done("Archived.", null, [{ op: "lead-status", leadId, status: lead.status }], "Answered: archived.");
    }
    case "paid-verify:confirmed": {
      const contactId = str(ref.contactId ?? ref.entityId);
      if (!contactId) throw new Error("Missing contact.");
      const rule = await createRule(db, question.brandId, "paid-confirmed", { contactId }, null, question.id);
      return done("Marked confirmed — the scan stops asking about it.", rule.id, [{ op: "rule-off", ruleId: rule.id }], "Answered: Tom confirmed payment.");
    }
    case "paid-verify:remove-tag": {
      const contactId = str(ref.contactId ?? ref.entityId);
      if (!contactId) throw new Error("Missing contact.");
      const brand = await db.brand.findUnique({ where: { id: question.brandId }, select: { slug: true } });
      if (!brand) throw new Error("Unknown brand.");
      const result = await applyPipeTag({ actorUserId, input: { brand: brand.slug, contactId, tag: "paid", action: "remove" } });
      const undo: UndoOp[] = result.changed ? [{ op: "tag", contactId, tag: "paid", added: true }] : [{ op: "none" }];
      return done(result.changed ? "Paid tag removed." : "The tag was already gone.", null, undo, "Answered: tag removed.");
    }
    case "won-verify:confirmed": {
      const leadId = str(ref.leadId ?? ref.entityId);
      if (!leadId) throw new Error("Missing deal.");
      const rule = await createRule(db, question.brandId, "won-confirmed", { leadId }, null, question.id);
      return done("Marked confirmed — the scan stops asking about it.", rule.id, [{ op: "rule-off", ruleId: rule.id }], "Answered: Tom confirmed.");
    }
    case "won-verify:reopen": {
      const leadId = str(ref.leadId ?? ref.entityId);
      if (!leadId) throw new Error("Missing deal.");
      const moved = await setDealStage(db, question.brandId, leadId, "proposed");
      const undo: UndoOp[] = moved ? [{ op: "deal-stage", leadId, stage: "won" }] : [{ op: "none" }];
      return done(moved ? "Reopened to proposed." : "Nothing was sitting at won.", null, undo, "Answered: reopened.");
    }
    case "no-contact:create": {
      const email = str(ref.email)?.toLowerCase() ?? null;
      const name = str(ref.name) ?? email ?? "Unknown";
      if (!email) throw new Error("No email to make the card from.");
      const existing = await db.contact.findFirst({ where: { brandId: question.brandId, email }, select: { id: true } });
      let contactId = existing?.id ?? null;
      if (!contactId) {
        const contact = await db.contact.create({
          data: { brandId: question.brandId, name, email, phoneNumber: str(ref.phone) },
          select: { id: true },
        });
        contactId = contact.id;
      }
      const undo: UndoOp[] = contactId && !existing ? [{ op: "contact-delete", contactId }] : [{ op: "none" }];
      return done(`Card created for ${name}.`, null, undo, "Answered: card created.");
    }
    case "no-contact:skip": {
      const engagementId = str(ref.engagementId ?? ref.entityId);
      if (!engagementId) throw new Error("Missing engagement.");
      const rule = await createRule(db, question.brandId, "no-contact-skip", { engagementId }, null, question.id);
      return done("Skipped — the scan stops asking about it.", rule.id, [{ op: "rule-off", ruleId: rule.id }], "Answered: skipped.");
    }
    case "broaden:yes": {
      const narrowIds = Array.isArray(ref.narrowIds) ? (ref.narrowIds as unknown[]).filter((id): id is string => typeof id === "string") : [];
      const domain = str(ref.domain);
      const ruleKind = str(ref.ruleKind);
      if (!domain || !ruleKind) throw new Error("Missing pattern.");
      const action = ruleKind === "always-spam" ? { senders: "domain" } : null;
      const rule = await createRule(db, question.brandId, ruleKind === "always-spam" ? "always-spam" : `${ruleKind}-domain`, { domain }, action, question.id);
      for (const id of narrowIds.slice(0, 50)) await deactivateRule(db, id);
      const undo: UndoOp[] = [{ op: "rule-off", ruleId: rule.id }];
      return done(`One rule now covers *@${domain}.`, rule.id, undo, "Answered: broadened.");
    }
    case "broaden:no": {
      const domain = str(ref.domain);
      const ruleKind = str(ref.ruleKind);
      if (!domain || !ruleKind) throw new Error("Missing pattern.");
      const rule = await createRule(db, question.brandId, "broaden-declined", { ruleKind, domain }, null, question.id);
      return done("Kept asking one by one.", rule.id, [{ op: "rule-off", ruleId: rule.id }], "Answered: declined.");
    }
    default:
      throw new Error("Not an offered answer.");
  }
}

/** Undo the last answer while it is still the latest word. */
export async function undoQuestion(db: Db, actorUserId: string, questionId: string): Promise<{ message: string }> {
  const question = await db.scanQuestion.findUnique({ where: { id: questionId } });
  if (!question) throw new Error("Question not found.");
  if (question.status !== "answered") return { message: "Nothing to undo." };
  const ops = (Array.isArray(question.undo) ? question.undo : []) as UndoOp[];
  for (const op of ops.reverse()) {
    if (op.op === "tag" && "contactId" in op && "tag" in op) {
      const brand = await db.brand.findUnique({ where: { id: question.brandId }, select: { slug: true } });
      if (brand) {
        await applyPipeTag({
          actorUserId,
          input: { brand: brand.slug, contactId: op.contactId, tag: op.tag, action: op.added ? "remove" : "add" },
        }).catch(() => undefined);
      }
    } else if (op.op === "lead-status" && "leadId" in op && "status" in op) {
      await db.lead.update({ where: { id: op.leadId }, data: { status: op.status as LeadStatus } }).catch(() => undefined);
    } else if (op.op === "contact-delete" && "contactId" in op) {
      const links = await db.leadContact.count({ where: { contactId: op.contactId } });
      const tags = await db.contactTagLink.count({ where: { contactId: op.contactId } });
      if (links === 0 && tags === 0) {
        await db.contact.delete({ where: { id: op.contactId } }).catch(() => undefined);
      }
    } else if (op.op === "rule-off" && "ruleId" in op) {
      await deactivateRule(db, op.ruleId);
    } else if (op.op === "deal-stage" && "leadId" in op && "stage" in op) {
      await setDealStage(db, question.brandId, op.leadId, op.stage === "won" ? "won" : "proposed");
    }
  }
  if (question.findingId) await reopenFinding(db, actorUserId, question.brandId, question.findingId);
  await db.scanQuestion.update({ where: { id: question.id }, data: { status: "open", answerKey: null, answeredAt: null } });
  return { message: "Undone — the question is back." };
}
