"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { codeFromName, normalizeClientCode } from "@/lib/clients/code";
import { parseSubmittedPhone } from "@/lib/phone";
import { parseEmailOrThrow } from "@/lib/email";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

async function uniqueCode(brandId: string, desired: string) {
  let code = desired;
  for (let i = 2; i < 50; i += 1) {
    const existing = await prisma.ticketClient.findUnique({
      where: { brandId_code: { brandId, code } },
      select: { id: true },
    });
    if (!existing) return code;
    code = `${desired.slice(0, 20)}-${i}`;
  }
  throw new Error("Could not generate a unique client code.");
}

export async function createClientAction(formData: FormData) {
  const { brand } = await requireStaffBrandOrThrow();
  const name = clean(formData.get("name"));
  if (!name) throw new Error("Client name is required.");

  const requested = normalizeClientCode(clean(formData.get("code"))) || codeFromName(name);
  const code = await uniqueCode(brand.id, requested);

  await prisma.ticketClient.create({
    data: {
      brandId: brand.id,
      code,
      name,
      isActive: true,
    },
  });

  revalidatePath("/clients");
}

export async function updateClientAction(formData: FormData) {
  const { brand } = await requireStaffBrandOrThrow();
  const clientId = clean(formData.get("clientId"));
  const name = clean(formData.get("name"));
  if (!clientId || !name) throw new Error("Client name is required.");

  const existing = await prisma.ticketClient.findFirst({
    where: { id: clientId, brandId: brand.id },
    select: { id: true, code: true },
  });
  if (!existing) throw new Error("Client not found.");

  const requested = normalizeClientCode(clean(formData.get("code"))) || existing.code;
  if (requested !== existing.code) {
    const collision = await prisma.ticketClient.findUnique({
      where: { brandId_code: { brandId: brand.id, code: requested } },
      select: { id: true },
    });
    if (collision) throw new Error("That client code is already in use.");
  }

  await prisma.ticketClient.update({
    where: { id: clientId },
    data: {
      name,
      code: requested,
      businessLegalName: clean(formData.get("businessLegalName")) || null,
      entityType: clean(formData.get("entityType")) || null,
      primaryContactPhone: parseSubmittedPhone(clean(formData.get("primaryContactPhone"))),
      authorizedCommunicationEmail: parseEmailOrThrow(clean(formData.get("email"))),
      isActive: formData.get("isActive") === "1",
    },
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
}

export async function linkContactToClientAction(formData: FormData) {
  const { brand } = await requireStaffBrandOrThrow();
  const clientId = clean(formData.get("clientId"));
  const contactId = clean(formData.get("contactId"));
  if (!clientId || !contactId) throw new Error("Select a contact to link.");

  const [client, contact] = await Promise.all([
    prisma.ticketClient.findFirst({ where: { id: clientId, brandId: brand.id }, select: { id: true } }),
    prisma.contact.findFirst({ where: { id: contactId, brandId: brand.id }, select: { id: true } }),
  ]);
  if (!client || !contact) throw new Error("Not found.");

  await prisma.clientContact.upsert({
    where: { clientId_contactId: { clientId, contactId } },
    create: { clientId, contactId },
    update: {},
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/contacts");
  revalidatePath(`/contacts/${contactId}`);
}

export async function unlinkContactFromClientAction(formData: FormData) {
  const { brand } = await requireStaffBrandOrThrow();
  const clientId = clean(formData.get("clientId"));
  const contactId = clean(formData.get("contactId"));
  if (!clientId || !contactId) throw new Error("Contact is required.");

  const client = await prisma.ticketClient.findFirst({
    where: { id: clientId, brandId: brand.id },
    select: { id: true },
  });
  if (!client) throw new Error("Client not found.");

  await prisma.clientContact.deleteMany({ where: { clientId, contactId } });

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/contacts");
}
