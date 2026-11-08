"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PipelineType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { PIPE_PROSPECTS_KEY } from "@/lib/pipe/deals";
import { LEAD_STEP_STAGE, LEAD_STEPS, type LeadStep } from "@/lib/pipe/lead-steps";
import { PIPELINE_TEMPLATES, type TemplateKey } from "./templates";
import { parseSubmittedPhone } from "@/lib/phone";
import { recordSalesEvidence } from "@/lib/automation/evidence";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function toKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function parseTemplate(raw: string): TemplateKey | null {
  return raw === "PROSPECTS" || raw === "LEADS" || raw === "CLIENT_PHASE_1" || raw === "CLIENT_PHASE_2"
    ? raw
    : null;
}

function parseType(raw: string): PipelineType {
  return raw === PipelineType.PROSPECTS || raw === PipelineType.LEADS || raw === PipelineType.CUSTOM
    ? raw
    : PipelineType.CUSTOM;
}

export async function createStarterPipelinesAction() {
  const { brand, membership } = await requireStaffBrandOrThrow();

  for (const templateKey of ["PROSPECTS", "LEADS", "CLIENT_PHASE_1", "CLIENT_PHASE_2"] as const) {
    const template = PIPELINE_TEMPLATES[templateKey];

    const pipeline = await prisma.pipeline.upsert({
      where: { brandId_key: { brandId: brand.id, key: template.key } },
      update: {
        isActive: true,
        type: template.type,
        description: template.description,
        name: template.name,
      },
      create: {
        brandId: brand.id,
        key: template.key,
        name: template.name,
        type: template.type,
        description: template.description,
        isActive: true,
        createdByMembershipId: membership?.id ?? null,
      },
      select: { id: true },
    });

    for (let i = 0; i < template.stages.length; i += 1) {
      const stage = template.stages[i];
      await prisma.pipelineStage.upsert({
        where: { pipelineId_key: { pipelineId: pipeline.id, key: stage.key } },
        update: {
          name: stage.name,
          description: stage.description,
          sortOrder: (i + 1) * 10,
          valueMultiplier: stage.valueMultiplier,
          isTerminal: Boolean(stage.isTerminal),
          isActive: true,
        },
        create: {
          pipelineId: pipeline.id,
          key: stage.key,
          name: stage.name,
          description: stage.description,
          sortOrder: (i + 1) * 10,
          valueMultiplier: stage.valueMultiplier,
          isTerminal: Boolean(stage.isTerminal),
        },
        select: { id: true },
      });
    }
  }

  revalidatePath("/pipeline");
  redirect("/pipeline?created=starter");
}

export async function createPipelineAction(formData: FormData) {
  const { brand, membership } = await requireStaffBrandOrThrow();

  const name = clean(formData.get("name"));
  const explicitKey = toKey(clean(formData.get("key")));
  const description = clean(formData.get("description"));
  const type = parseType(clean(formData.get("type")).toUpperCase());
  const templateKey = parseTemplate(clean(formData.get("template")).toUpperCase());

  if (!name) redirect("/pipeline?error=name-required");

  const baseKey = explicitKey || toKey(name);
  if (!baseKey) redirect("/pipeline?error=key-invalid");

  let finalKey = baseKey;
  let suffix = 2;
  while (
    await prisma.pipeline.findUnique({
      where: { brandId_key: { brandId: brand.id, key: finalKey } },
      select: { id: true },
    })
  ) {
    finalKey = `${baseKey}-${suffix}`;
    suffix += 1;
  }

  const templateStages = templateKey ? PIPELINE_TEMPLATES[templateKey].stages : [];

  await prisma.pipeline.create({
    data: {
      brandId: brand.id,
      key: finalKey,
      name,
      type,
      description: description || null,
      isActive: true,
      createdByMembershipId: membership?.id ?? null,
      stages: templateStages.length
        ? {
            create: templateStages.map((stage, index) => ({
              key: stage.key,
              name: stage.name,
              description: stage.description,
              sortOrder: (index + 1) * 10,
              valueMultiplier: stage.valueMultiplier,
              isTerminal: Boolean(stage.isTerminal),
            })),
          }
        : undefined,
    },
    select: { id: true },
  });

  revalidatePath("/pipeline");
  redirect("/pipeline?created=custom");
}

export async function createPipelineLeadAction(formData: FormData) {
  const { brand } = await requireStaffBrandOrThrow();
  const pipelineKey = clean(formData.get("pipelineKey"));
  const stageId = clean(formData.get("stageId"));
  const name = clean(formData.get("name")).slice(0, 200);
  const company = clean(formData.get("company")).slice(0, 200);
  const email = clean(formData.get("email")).toLowerCase().slice(0, 254);
  const rawPhone = clean(formData.get("phone")).slice(0, 64);
  const phoneE164 = rawPhone ? parseSubmittedPhone(rawPhone) : null;
  const notes = clean(formData.get("notes")).slice(0, 2_000);
  const offerType = clean(formData.get("offerType"));
  const valueBasis = clean(formData.get("valueBasis"));
  const rawValue = clean(formData.get("value"));
  const valueAmount = rawValue ? Number(rawValue) : null;

  if (!pipelineKey || !stageId || !name) throw new Error("Pipeline, stage, and name are required.");
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid email address.");
  if (!["bookkeeping", "onsite", "training"].includes(offerType)) throw new Error("Choose a service type.");
  if (!["monthly", "one_time", "unpriced"].includes(valueBasis)) throw new Error("Choose a value basis.");
  if (valueAmount !== null && (!Number.isFinite(valueAmount) || valueAmount < 0 || valueAmount > 999999999999.99)) {
    throw new Error("Enter a valid estimated value of 0 or more.");
  }
  if (valueAmount !== null && valueBasis === "unpriced") throw new Error("Choose monthly or one-time for a priced opportunity.");

  const [pipeline, stage] = await Promise.all([
    prisma.pipeline.findFirst({
      where: { brandId: brand.id, key: pipelineKey, isActive: true },
      select: { id: true, key: true },
    }),
    prisma.pipelineStage.findFirst({
      where: { id: stageId, isActive: true, pipeline: { brandId: brand.id, key: pipelineKey, isActive: true } },
      select: { id: true },
    }),
  ]);
  if (!pipeline || !stage) throw new Error("Pipeline stage not found for this brand.");

  await prisma.$transaction(async (transaction) => {
    const lead = await transaction.meetingLead.create({
      data: {
        brandId: brand.id,
        name,
        company: company || null,
        email: email || null,
        notes: notes || null,
        offerType,
        valueBasis,
        kind: "LEAD",
      },
      select: { id: true },
    });
    await transaction.pipelineItem.create({
      data: {
        pipelineId: pipeline.id,
        stageId: stage.id,
        leadId: lead.id,
        baseValueUsd: valueBasis === "unpriced" ? 0 : valueAmount ?? 0,
      },
      select: { id: true },
    });

    if (phoneE164 || email) {
      const contact = await transaction.contact.findFirst({
        where: {
          brandId: brand.id,
          isActive: true,
          OR: [
            ...(phoneE164 ? [{ phoneE164 }, { phoneNumber: phoneE164 }] : []),
            ...(email ? [{ email }] : []),
          ],
        },
        select: { id: true },
      });
      const linkedContact = contact ?? await transaction.contact.create({
        data: {
          brandId: brand.id,
          name,
          email: email || null,
          phoneE164,
          phoneNumber: rawPhone || null,
          company: company || null,
        },
        select: { id: true },
      });
      await transaction.leadContact.create({
        data: { brandId: brand.id, leadId: lead.id, contactId: linkedContact.id },
        select: { id: true },
      });
    }
    await recordSalesEvidence(transaction, {
      brandId: brand.id,
      leadId: lead.id,
      source: "swapp",
      sourceEventId: `${lead.id}:created`,
      eventType: "opportunity.created",
      occurredAt: new Date(),
      summary: `${name} entered ${pipeline.key}.`,
      sourceRef: `/leads/${lead.id}`,
    });
  });

  revalidatePath(`/pipeline/${encodeURIComponent(pipeline.key)}`);
  revalidatePath("/pipeline");
  redirect(`/pipeline/${encodeURIComponent(pipeline.key)}?created=lead`);
}

export async function movePipelineItemAction(formData: FormData) {
  const { brand } = await requireStaffBrandOrThrow();

  const itemId = clean(formData.get("itemId"));
  const stageId = clean(formData.get("stageId"));
  if (!itemId || !stageId) throw new Error("itemId and stageId are required.");

  const item = await prisma.pipelineItem.findFirst({
    where: {
      id: itemId,
      pipeline: { brandId: brand.id },
      lead: { brandId: brand.id },
    },
    select: {
      id: true,
      pipelineId: true,
      pipeline: { select: { key: true } },
      stage: { select: { name: true } },
      lead: { select: { id: true, name: true, updatedAt: true } },
    },
  });
  if (!item) throw new Error("Pipeline item not found for this brand.");

  const stage = await prisma.pipelineStage.findFirst({
    where: { id: stageId, pipelineId: item.pipelineId, isActive: true },
    select: { id: true, key: true, name: true },
  });
  if (!stage) throw new Error("Target stage is not part of this pipeline.");

  let leadStepUpdate: { leadStep: string | null } | null = null;
  if (item.pipeline.key === PIPE_PROSPECTS_KEY) {
    if (!formData.has("leadStep")) throw new Error("A Leads step is required for this pipeline move.");
    const rawLeadStep = clean(formData.get("leadStep"));
    const leadStep = rawLeadStep || null;
    if (leadStep && !(LEAD_STEPS as readonly string[]).includes(leadStep)) {
      throw new Error("Invalid Leads step.");
    }
    if (leadStep && LEAD_STEP_STAGE[leadStep as LeadStep] !== stage.key) {
      throw new Error(`The ${leadStep} step must use the ${LEAD_STEP_STAGE[leadStep as LeadStep]} stage.`);
    }
    if (!leadStep && !["prospect", "won", "lost"].includes(stage.key)) {
      throw new Error("Only Prospect, Won, or Lost can be used without a Leads step.");
    }
    leadStepUpdate = { leadStep };
  }

  // Pipe reports MeetingLead.updatedAt. Keep it strictly increasing even if
  // two moves happen within one clock tick or the app clock moves backward.
  const movedAt = new Date(Math.max(Date.now(), item.lead.updatedAt.getTime() + 1));
  await prisma.$transaction(async (transaction) => {
    await transaction.meetingLead.update({
      where: { id: item.lead.id },
      data: { updatedAt: movedAt, ...(leadStepUpdate ?? {}) },
      select: { id: true },
    });
    await transaction.pipelineItem.update({
      where: { id: item.id },
      data: { stageId: stage.id },
      select: { id: true },
    });
    await recordSalesEvidence(transaction, {
      brandId: brand.id,
      leadId: item.lead.id,
      source: "swapp",
      sourceEventId: `${item.id}:stage:${movedAt.getTime()}`,
      eventType: "opportunity.stage_changed",
      occurredAt: movedAt,
      summary: `${item.lead.name} moved from ${item.stage.name} to ${stage.name} in ${item.pipeline.key}.`,
      sourceRef: `/leads/${item.lead.id}`,
    });
  });

  revalidatePath(`/pipeline/${item.pipeline.key}`);
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
}

export async function addLeadNoteAction(formData: FormData) {
  const { brand } = await requireStaffBrandOrThrow();

  const itemId = clean(formData.get("itemId"));
  const text = clean(formData.get("text"));
  if (!itemId || !text) return;
  if (text.length > 2_000) throw new Error("Call notes must be 2,000 characters or fewer.");

  const item = await prisma.pipelineItem.findFirst({
    where: { id: itemId, pipeline: { brandId: brand.id } },
    select: {
      lead: { select: { id: true, notes: true } },
      pipeline: { select: { key: true } },
    },
  });
  if (!item) throw new Error("Pipeline item not found for this brand.");

  const stamp = new Date().toISOString().replace("T", " ").slice(0, 16);
  const entry = `${stamp} UTC — Call: ${text}`;
  const nextNotes = item.lead.notes ? `${entry}\n\n${item.lead.notes}` : entry;

  await prisma.meetingLead.update({
    where: { id: item.lead.id },
    data: { notes: nextNotes },
    select: { id: true },
  });

  revalidatePath(`/pipeline/${item.pipeline.key}`);
}

export async function updateStageMultiplierAction(formData: FormData) {
  const { brand } = await requireStaffBrandOrThrow();

  const stageId = clean(formData.get("stageId"));
  const pipelineKey = clean(formData.get("pipelineKey"));
  const rawMultiplier = Number(formData.get("valueMultiplier"));
  if (!stageId || !Number.isFinite(rawMultiplier)) return;
  const nextValue = Math.max(0, Math.min(10, rawMultiplier));

  const stage = await prisma.pipelineStage.findFirst({
    where: { id: stageId, pipeline: { brandId: brand.id } },
    select: { id: true },
  });
  if (!stage) throw new Error("Stage not found for this brand.");

  await prisma.pipelineStage.update({
    where: { id: stage.id },
    data: { valueMultiplier: nextValue },
    select: { id: true },
  });

  revalidatePath(`/pipeline/${pipelineKey}`);
}
