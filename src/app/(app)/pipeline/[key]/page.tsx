import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaffBrand } from "@/lib/brands/staff";
import { withBrandDataTransaction } from "@/lib/tenancy/context";
import { PIPE_PROSPECTS_KEY } from "@/lib/pipe/deals";
import { LEAD_STEP_LABEL, LEAD_STEP_STAGE, LEAD_STEPS, pipeLeadBoardColumnId, type LeadStep } from "@/lib/pipe/lead-steps";
import { updateStageMultiplierAction } from "../actions";
import PipelineBoard from "./PipelineBoard";

function toNumber(value: unknown) {
  if (value == null) return 0;
  const asAny = value as { toNumber?: () => number; toString?: () => string };
  if (typeof asAny.toNumber === "function") return asAny.toNumber();
  const parsed = Number(asAny.toString?.() ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

const ghost =
  "inline-flex h-9 cursor-pointer items-center rounded-full border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";
const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-slate-500 focus:outline-none";

export default async function PipelineDetailPage({ params }: { params: Promise<{ key: string }> }) {
  const { brand, dataContext } = await requireStaffBrand();
  const { key } = await params;

  const pipeline = await prisma.pipeline.findUnique({
    where: { brandId_key: { brandId: brand.id, key } },
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      stages: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          key: true,
          name: true,
          description: true,
          sortOrder: true,
          valueMultiplier: true,
        },
      },
      items: {
        where: { isActive: true },
        select: {
          id: true,
          stageId: true,
          baseValueUsd: true,
          stage: { select: { id: true, key: true, valueMultiplier: true } },
          lead: {
            select: {
              id: true,
              name: true,
              company: true,
              email: true,
              clientId: true,
              kind: true,
              bookkeepingCategory: true,
              expectedServices: true,
              notes: true,
              leadStep: true,
            },
          },
        },
      },
    },
  });
  if (!pipeline) notFound();

  const leadIds = [...new Set(pipeline.items.map((item) => item.lead.id))];
  const pipelineContacts = leadIds.length
    ? await withBrandDataTransaction(dataContext, async (transaction) => {
        const links = await transaction.leadContact.findMany({
          where: { brandId: brand.id, leadId: { in: leadIds } },
          orderBy: { createdAt: "asc" },
          select: { leadId: true, contactId: true },
        });
        const contactIds = [...new Set(links.map((link) => link.contactId))];
        const contacts = contactIds.length
          ? await transaction.contact.findMany({
              where: { brandId: brand.id, id: { in: contactIds } },
              select: { id: true, name: true, phoneE164: true },
            })
          : [];
        return links.map((link) => ({ leadId: link.leadId, contact: contacts.find((contact) => contact.id === link.contactId) ?? null }));
      })
    : [];
  const contactsByLead = new Map<string, (typeof pipelineContacts)[number]["contact"][]>();
  for (const link of pipelineContacts) {
    if (!link.contact) continue;
    contactsByLead.set(link.leadId, [...(contactsByLead.get(link.leadId) ?? []), link.contact]);
  }

  const stageMap = new Map(pipeline.stages.map((stage) => [stage.id, stage]));
  const pipeLeadBoard = pipeline.key === PIPE_PROSPECTS_KEY;
  const stagesByKey = new Map(pipeline.stages.map((stage) => [stage.key, stage]));
  const boardStages = pipeLeadBoard
    ? [
        ...LEAD_STEPS.map((step) => {
          const underlyingStage = stagesByKey.get(LEAD_STEP_STAGE[step]);
          return {
            id: `lead-step-${step}`,
            targetStageId: underlyingStage?.id ?? "",
            key: step,
            name: LEAD_STEP_LABEL[step],
            valueMultiplier: toNumber(underlyingStage?.valueMultiplier),
            leadStep: step,
            clearLeadStep: false,
          };
        }),
        ...pipeline.stages
          .filter((stage) => !["lead", "talking", "proposed"].includes(stage.key))
          .map((stage) => ({
            id: stage.id,
            targetStageId: stage.id,
            key: stage.key,
            name: stage.name,
            valueMultiplier: toNumber(stage.valueMultiplier),
            leadStep: null,
            clearLeadStep: true,
          })),
      ]
    : pipeline.stages.map((stage) => ({
        id: stage.id,
        targetStageId: stage.id,
        key: stage.key,
        name: stage.name,
        valueMultiplier: toNumber(stage.valueMultiplier),
        leadStep: null,
        clearLeadStep: false,
      }));
  const cards = pipeline.items.map((item) => {
    const stage = stageMap.get(item.stageId);
    const multiplier = toNumber(stage?.valueMultiplier ?? item.stage.valueMultiplier);
    const baseValue = toNumber(item.baseValueUsd);
    const firstContact = contactsByLead.get(item.lead.id)?.[0];
    const rawLeadStep = item.lead.leadStep;
    const storedLeadStep = rawLeadStep && LEAD_STEPS.includes(rawLeadStep as LeadStep)
      && LEAD_STEP_STAGE[rawLeadStep as LeadStep] === item.stage.key
      ? rawLeadStep as LeadStep
      : null;
    const boardStageId = pipeLeadBoard
      ? pipeLeadBoardColumnId(item.stageId, item.stage.key, storedLeadStep)
      : item.stageId;
    return {
      id: item.id,
      stageId: boardStageId,
      leadStep: storedLeadStep,
      leadName: item.lead.name,
      leadCompany: item.lead.company,
      leadEmail: item.lead.email,
      leadPhone: firstContact?.phoneE164 ?? null,
      leadStatus: item.lead.clientId ? "CLIENT" : item.lead.kind,
      contactId: firstContact?.id ?? null,
      contactName: firstContact?.name ?? null,
      leadKind: item.lead.kind,
      category: item.lead.bookkeepingCategory,
      expectedServices: item.lead.expectedServices,
      notes: item.lead.notes,
      baseValueUsd: baseValue,
      weightedValueUsd: baseValue * multiplier,
    };
  });

  const totalCards = cards.length;
  const baseValueTotal = cards.reduce((sum, card) => sum + card.baseValueUsd, 0);
  const weightedValueTotal = cards.reduce((sum, card) => sum + card.weightedValueUsd, 0);

  return (
    <div className="p-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <Link href="/pipeline" className="text-xs text-slate-500 hover:underline">
            ← All CRM pipelines
          </Link>
          <h1 className="mt-1 text-lg font-semibold text-slate-900">{pipeline.name}</h1>
          {pipeline.description ? <p className="mt-1 text-sm text-slate-600">{pipeline.description}</p> : null}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">Metrics</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Cards in pipeline</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{totalCards}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Base value total</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              ${baseValueTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Weighted pipeline value</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              ${weightedValueTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      </div>

      {!pipeLeadBoard ? <details className="mt-5 rounded-xl border border-slate-200 bg-white p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">Stage settings</h2>
          <span className={ghost}>Toggle</span>
        </summary>
        <div className="mt-3 grid gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stage multipliers</p>
          {pipeline.stages.map((stage) => (
            <form
              key={stage.id}
              action={updateStageMultiplierAction}
              className="grid items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 md:grid-cols-[1fr_160px_auto]"
            >
              <input type="hidden" name="stageId" value={stage.id} />
              <input type="hidden" name="pipelineKey" value={pipeline.key} />
              <div>
                <p className="text-sm font-semibold text-slate-900">{stage.name}</p>
                <p className="text-xs text-slate-500">{stage.key}</p>
              </div>
              <label className="grid gap-1 text-xs font-medium text-slate-600">
                Multiplier
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="10"
                  name="valueMultiplier"
                  defaultValue={toNumber(stage.valueMultiplier).toFixed(2)}
                  className={inputClass}
                />
              </label>
              <button type="submit" className={ghost}>
                Save
              </button>
            </form>
          ))}
        </div>
      </details> : null}

      <PipelineBoard
        pipelineKey={pipeline.key}
        isPipeLeadBoard={pipeLeadBoard}
        stages={boardStages}
        items={cards}
      />
    </div>
  );
}
