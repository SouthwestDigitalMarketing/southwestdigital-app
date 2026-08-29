"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PipelineType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { PIPELINE_TEMPLATES, type TemplateKey } from "./templates";

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

export async function movePipelineItemAction(formData: FormData) {
  const { brand } = await requireStaffBrandOrThrow();

  const itemId = clean(formData.get("itemId"));
  const stageId = clean(formData.get("stageId"));
  const pipelineKey = clean(formData.get("pipelineKey"));
  if (!itemId || !stageId) throw new Error("itemId and stageId are required.");

  const item = await prisma.pipelineItem.findFirst({
    where: {
      id: itemId,
      pipeline: { brandId: brand.id },
      lead: { brandId: brand.id },
    },
    select: { id: true, pipelineId: true },
  });
  if (!item) throw new Error("Pipeline item not found for this brand.");

  const stage = await prisma.pipelineStage.findFirst({
    where: { id: stageId, pipelineId: item.pipelineId, isActive: true },
    select: { id: true },
  });
  if (!stage) throw new Error("Target stage is not part of this pipeline.");

  await prisma.pipelineItem.update({
    where: { id: item.id },
    data: { stageId: stage.id },
    select: { id: true },
  });

  revalidatePath(`/pipeline/${pipelineKey}`);
  revalidatePath("/pipeline");
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
