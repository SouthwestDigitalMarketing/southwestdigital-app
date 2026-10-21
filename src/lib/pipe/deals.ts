import "server-only";

import { LeadKind, PipelineType, Prisma } from "@prisma/client";
import { createBrandDataContext, withBrandDataTransaction } from "@/lib/tenancy/context";
import { PipeBrandError, resolveBrand } from "./contacts";

/**
 * Deals (prospects) synced with the `pipe` terminal tool.
 *
 * Unlike contacts and businesses, a deal IS its changing state: stages move
 * and next steps land daily. So the upsert updates the working fields every
 * time, matched by the stable key (brand, pipeId) — pipe's deal numbers
 * never change. Account and stage rows the sync needs are created on first
 * use; SWapp's own QuickBooks pipelines are never touched.
 */

export const PIPE_STAGES = ["prospect", "lead", "talking", "proposed", "won", "lost"] as const;
export type PipeStage = (typeof PIPE_STAGES)[number];

const TERMINAL_STAGES: ReadonlySet<string> = new Set(["won", "lost"]);

export const PIPE_PROSPECTS_KEY = "pipe-prospects";

const STAGE_ORDER: { key: PipeStage; name: string; sortOrder: number }[] = [
  { key: "prospect", name: "Prospect", sortOrder: 10 },
  { key: "lead", name: "Lead", sortOrder: 20 },
  { key: "talking", name: "Talking", sortOrder: 30 },
  { key: "proposed", name: "Proposed", sortOrder: 40 },
  { key: "won", name: "Won", sortOrder: 50 },
  { key: "lost", name: "Lost", sortOrder: 60 },
];

export const PIPE_KINDS = ["offer", "invoice"] as const;

/**
 * pipe's Leads board steps. Each rides on one pipe stage, so a step is only
 * valid for that stage: reach=lead; qb/book/call=talking; quote/nurture=proposed.
 */
export const LEAD_STEPS = ["reach", "qb", "book", "call", "quote", "nurture"] as const;
export type LeadStep = (typeof LEAD_STEPS)[number];

export const LEAD_STEP_STAGE: Record<LeadStep, PipeStage> = {
  reach: "lead",
  qb: "talking",
  book: "talking",
  call: "talking",
  quote: "proposed",
  nurture: "proposed",
};

function asLeadStep(value: unknown): LeadStep | null {
  return typeof value === "string" && (LEAD_STEPS as readonly string[]).includes(value)
    ? (value as LeadStep)
    : null;
}

export type PipeDealInput = {
  brand: string;
  /** pipe's deal number, the stable cross-system key. */
  pipeId: string;
  /** pipe's deal number under other casings. */
  pipe_id?: string | null;
  name: string;
  stage?: string | null;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  /** SWapp contact id for the person behind the deal, either casing. */
  contact?: string | null;
  contactId?: string | null;
  /** SWapp business account id, either casing. */
  business?: string | null;
  businessId?: string | null;
  next_action?: string | null;
  nextAction?: string | null;
  next_due?: string | null;
  nextDue?: string | null;
  value_monthly?: number | string | null;
  valueMonthly?: number | string | null;
  amount?: number | string | null;
  kind?: string | null;
  amountKind?: string | null;
  invoice_ref?: string | null;
  invoiceRef?: string | null;
  invoice_date?: string | null;
  invoiceDate?: string | null;
  /** SWapp contact id of who said yes, either casing. */
  yes_contact?: string | null;
  yesContact?: string | null;
  /** pipe's Leads step, one of LEAD_STEPS or null to clear, either casing. */
  lead_step?: string | null;
  leadStep?: string | null;
};

export type ParsedPipeDeal = {
  brand: string;
  pipeId: string;
  name: string;
  stage: PipeStage;
  company: string | null;
  phone: string | null;
  email: string | null;
  contact: string | null;
  business: string | null;
  nextAction: string | null;
  nextDue: string | null;
  valueMonthly: number | null;
  amount: number | null;
  amountKind: string | null;
  invoiceRef: string | null;
  invoiceDate: string | null;
  yesContact: string | null;
  /**
   * undefined: the request did not mention the step, so a stored step is left
   * alone (unless the stage moved away from it). null: clear it.
   */
  leadStep: LeadStep | null | undefined;
};

export type PipeDeal = Omit<ParsedPipeDeal, "leadStep"> & {
  /** Always present in answers; null when the deal has no step. */
  leadStep: LeadStep | null;
  id: string;
  updatedAt: string;
};

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

function parseLeadStep(raw: Record<string, unknown>, stage: PipeStage): LeadStep | null | undefined {
  const key = "lead_step" in raw ? "lead_step" : "leadStep" in raw ? "leadStep" : null;
  if (!key) return undefined;
  const value = raw[key];
  if (value === null) return null;
  const step = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!(LEAD_STEPS as readonly string[]).includes(step)) {
    throw new RangeError(`lead_step must be one of: ${LEAD_STEPS.join(", ")}, or null`);
  }
  if (LEAD_STEP_STAGE[step as LeadStep] !== stage) {
    throw new RangeError(`lead_step ${step} belongs to stage ${LEAD_STEP_STAGE[step as LeadStep]}, not ${stage}`);
  }
  return step as LeadStep;
}

function cleanMoney(value: unknown, field: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const amount = typeof value === "number" ? value : Number(String(value).replace(/[$,]/g, ""));
  if (!Number.isFinite(amount)) throw new RangeError(`${field} must be a number`);
  return amount;
}

export function parsePipeDealInput(body: unknown): ParsedPipeDeal {
  const raw = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const input = raw as PipeDealInput;
  const brand = clean(input.brand, 80);
  const pipeId = clean(input.pipeId ?? input.pipe_id, 32);
  const name = clean(input.name, 200);
  if (!brand) throw new RangeError("brand is required");
  if (!pipeId) throw new RangeError("pipe_id is required");
  if (!name) throw new RangeError("name is required");
  const stageRaw = (clean(input.stage, 32) ?? "prospect").toLowerCase();
  if (!(PIPE_STAGES as readonly string[]).includes(stageRaw)) {
    throw new RangeError(`stage must be one of: ${PIPE_STAGES.join(", ")}`);
  }
  const email = clean(input.email, 254)?.toLowerCase() ?? null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new RangeError("email is not valid");
  const kind = clean(input.kind ?? input.amountKind, 32)?.toLowerCase() ?? null;
  if (kind && !(PIPE_KINDS as readonly string[]).includes(kind)) {
    throw new RangeError(`kind must be one of: ${PIPE_KINDS.join(", ")}`);
  }
  return {
    brand,
    pipeId,
    name,
    stage: stageRaw as PipeStage,
    company: clean(input.company, 200),
    phone: clean(input.phone, 64),
    email,
    contact: clean(input.contact ?? input.contactId, 64),
    business: clean(input.business ?? input.businessId, 64),
    nextAction: clean(input.next_action ?? input.nextAction, 500),
    nextDue: clean(input.next_due ?? input.nextDue, 32),
    valueMonthly: cleanMoney(input.value_monthly ?? input.valueMonthly, "value_monthly"),
    amount: cleanMoney(input.amount, "amount"),
    amountKind: kind,
    invoiceRef: clean(input.invoice_ref ?? input.invoiceRef, 120),
    invoiceDate: clean(input.invoice_date ?? input.invoiceDate, 32),
    yesContact: clean(input.yes_contact ?? input.yesContact, 64),
    leadStep: parseLeadStep(raw, stageRaw as PipeStage),
  };
}

const leadSelect = {
  id: true,
  pipeId: true,
  name: true,
  company: true,
  email: true,
  customerAccountId: true,
  nextAction: true,
  nextDue: true,
  amount: true,
  amountKind: true,
  invoiceRef: true,
  invoiceDate: true,
  yesContactId: true,
  leadStep: true,
  updatedAt: true,
  contacts: { select: { contactId: true }, orderBy: { createdAt: "asc" } },
} as const;

type LeadRow = Prisma.MeetingLeadGetPayload<{ select: typeof leadSelect }>;

type ItemRow = {
  baseValueUsd: Prisma.Decimal | number;
  stage: { key: string };
  lead: LeadRow;
};

function present(slug: string, item: ItemRow): PipeDeal {
  const lead = item.lead;
  return {
    id: lead.id,
    brand: slug,
    pipeId: lead.pipeId ?? "",
    name: lead.name,
    stage: item.stage.key as PipeStage,
    company: lead.company,
    phone: null,
    email: lead.email,
    contact: lead.contacts[0]?.contactId ?? null,
    business: lead.customerAccountId,
    nextAction: lead.nextAction,
    nextDue: lead.nextDue,
    valueMonthly: Number(item.baseValueUsd),
    amount: lead.amount === null ? null : Number(lead.amount),
    amountKind: lead.amountKind,
    invoiceRef: lead.invoiceRef,
    invoiceDate: lead.invoiceDate,
    yesContact: lead.yesContactId,
    leadStep: asLeadStep(lead.leadStep),
    updatedAt: lead.updatedAt.toISOString(),
  };
}

/**
 * The step to store on an update. A step the request names (or clears) wins.
 * Otherwise the stored step stays only while it still fits the stage, so a
 * stage push without a step never leaves a step from another stage behind.
 */
function nextLeadStep(input: ParsedPipeDeal, stored: LeadStep | null): LeadStep | null {
  if (input.leadStep !== undefined) return input.leadStep;
  return stored && LEAD_STEP_STAGE[stored] === input.stage ? stored : null;
}

export type PipeDealUpsert = {
  created: boolean;
  deal: PipeDeal;
  skipped: { field: string; id: string; reason: string }[];
};

/**
 * Create the deal on first sight, then keep its working fields level on
 * every later push: stage, next step, money, invoice, who said yes, and
 * the people and business behind it. Unknown contact, business, or yes
 * ids are ignored, never created.
 */
export async function upsertPipeDeal(args: {
  actorUserId: string;
  input: ParsedPipeDeal;
}): Promise<PipeDealUpsert> {
  const { input } = args;
  const brand = await resolveBrand(input.brand);
  const context = createBrandDataContext({ brandId: brand.id, actorUserId: args.actorUserId });
  return withBrandDataTransaction(context, async (transaction) => {
    let pipeline = await transaction.pipeline.findUnique({
      where: { brandId_key: { brandId: brand.id, key: PIPE_PROSPECTS_KEY } },
      select: { id: true },
    });
    if (!pipeline) {
      pipeline = await transaction.pipeline.create({
        data: {
          brandId: brand.id,
          key: PIPE_PROSPECTS_KEY,
          name: "Pipe Prospects",
          type: PipelineType.CUSTOM,
          description: "Deals worked from the pipe terminal tool, using pipe's stages.",
          stages: {
            create: STAGE_ORDER.map((stage) => ({
              key: stage.key,
              name: stage.name,
              sortOrder: stage.sortOrder,
              isTerminal: TERMINAL_STAGES.has(stage.key),
            })),
          },
        },
        select: { id: true },
      });
    }
    const stageRows = await transaction.pipelineStage.findMany({
      where: { pipelineId: pipeline.id },
      select: { id: true, key: true },
    });
    const stages = new Map(stageRows.map((stage) => [stage.key, stage.id]));
    for (const spec of STAGE_ORDER) {
      if (!stages.has(spec.key)) {
        const created = await transaction.pipelineStage.create({
          data: {
            pipelineId: pipeline.id,
            key: spec.key,
            name: spec.name,
            sortOrder: spec.sortOrder,
            isTerminal: TERMINAL_STAGES.has(spec.key),
          },
          select: { id: true, key: true },
        });
        stages.set(created.key, created.id);
      }
    }
    const stageId = stages.get(input.stage);
    if (!stageId) throw new PipeBrandError(`unknown stage ${input.stage}`);

    const skipped: { field: string; id: string; reason: string }[] = [];
    async function known(
      field: "contact" | "business" | "yesContact",
      id: string | null,
    ): Promise<string | null> {
      if (!id) return null;
      const found =
        field === "business"
          ? await transaction.customerAccount.findFirst({
              where: { brandId: brand.id, id },
              select: { id: true },
            })
          : await transaction.contact.findFirst({
              where: { brandId: brand.id, id },
              select: { id: true },
            });
      if (!found) skipped.push({ field, id, reason: "unknown id" });
      return found?.id ?? null;
    }
    const contactId = await known("contact", input.contact);
    const accountId = await known("business", input.business);
    const yesContactId = await known("yesContact", input.yesContact);

    let lead = await transaction.meetingLead.findUnique({
      where: { brandId_pipeId: { brandId: brand.id, pipeId: input.pipeId } },
      select: { id: true, leadStep: true },
    });
    let created = false;
    if (!lead) {
      lead = await transaction.meetingLead.create({
        data: {
          brandId: brand.id,
          pipeId: input.pipeId,
          name: input.name,
          kind: LeadKind.PROSPECT,
          company: input.company,
          email: input.email,
          customerAccountId: accountId,
          nextAction: input.nextAction,
          nextDue: input.nextDue,
          amount: input.amount,
          amountKind: input.amountKind,
          invoiceRef: input.invoiceRef,
          invoiceDate: input.invoiceDate,
          yesContactId,
          leadStep: input.leadStep ?? null,
        },
        select: { id: true, leadStep: true },
      });
      created = true;
    } else {
      await transaction.meetingLead.update({
        where: { id: lead.id },
        data: {
          name: input.name,
          company: input.company,
          email: input.email,
          customerAccountId: accountId,
          nextAction: input.nextAction,
          nextDue: input.nextDue,
          amount: input.amount,
          amountKind: input.amountKind,
          invoiceRef: input.invoiceRef,
          invoiceDate: input.invoiceDate,
          yesContactId,
          leadStep: nextLeadStep(input, asLeadStep(lead.leadStep)),
        },
        select: { id: true },
      });
    }
    if (contactId) {
      await transaction.leadContact.upsert({
        where: { leadId_contactId: { leadId: lead.id, contactId } },
        create: { brandId: brand.id, leadId: lead.id, contactId },
        update: {},
        select: { id: true },
      });
    }
    await transaction.pipelineItem.upsert({
      where: { pipelineId_leadId: { pipelineId: pipeline.id, leadId: lead.id } },
      create: {
        pipelineId: pipeline.id,
        stageId,
        leadId: lead.id,
        baseValueUsd: input.valueMonthly ?? 0,
      },
      update: { stageId, baseValueUsd: input.valueMonthly ?? 0, isActive: true },
      select: { id: true },
    });
    const item = await transaction.pipelineItem.findUniqueOrThrow({
      where: { pipelineId_leadId: { pipelineId: pipeline.id, leadId: lead.id } },
      select: {
        baseValueUsd: true,
        stage: { select: { key: true } },
        lead: { select: leadSelect },
      },
    });
    return { created, deal: present(brand.slug, item), skipped };
  });
}

export async function listPipeDeals(args: {
  actorUserId: string;
  brand: string;
  query?: string;
}): Promise<PipeDeal[]> {
  const brand = await resolveBrand(args.brand);
  const context = createBrandDataContext({ brandId: brand.id, actorUserId: args.actorUserId });
  const q = args.query?.trim();
  const items = await withBrandDataTransaction(context, async (transaction) => {
    const pipeline = await transaction.pipeline.findUnique({
      where: { brandId_key: { brandId: brand.id, key: PIPE_PROSPECTS_KEY } },
      select: { id: true },
    });
    if (!pipeline) return [];
    return transaction.pipelineItem.findMany({
      where: {
        pipelineId: pipeline.id,
        isActive: true,
        ...(q
          ? {
              lead: {
                OR: [
                  { name: { contains: q, mode: "insensitive" } },
                  { company: { contains: q, mode: "insensitive" } },
                ],
              },
            }
          : {}),
      },
      select: {
        baseValueUsd: true,
        stage: { select: { key: true } },
        lead: { select: leadSelect },
      },
      orderBy: { lead: { name: "asc" } },
      take: 200,
    });
  });
  return items.map((item) => present(brand.slug, item));
}
