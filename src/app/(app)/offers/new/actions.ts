"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireQuoteStaffOrThrow } from "@/lib/quotes/access";
import { buildQuote, previewScenarioQuotes } from "@/lib/quotes/engine";
import type { PackagePreview, QuoteInputs } from "@/lib/quotes/types";
import { ProposalCatalogScenario } from "@prisma/client";

function str(fd: FormData, key: string): string {
  return (fd.get(key) as string | null)?.trim() ?? "";
}

function optStr(fd: FormData, key: string): string | undefined {
  const v = (fd.get(key) as string | null)?.trim();
  return v || undefined;
}

function optInt(fd: FormData, key: string): number | undefined {
  const v = (fd.get(key) as string | null)?.trim();
  if (!v) return undefined;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? undefined : n;
}

function optFloat(fd: FormData, key: string): number | undefined {
  const v = (fd.get(key) as string | null)?.trim();
  if (!v) return undefined;
  const n = parseFloat(v);
  return Number.isNaN(n) ? undefined : n;
}

function parseInputs(formData: FormData): QuoteInputs {
  return {
    number_of_properties: optInt(formData, "numberOfProperties"),
    number_of_entities: optInt(formData, "numberOfEntities"),
    transaction_volume_estimate:
      (optStr(formData, "transactionVolume") as QuoteInputs["transaction_volume_estimate"]) ??
      undefined,
    urgency_level: (optStr(formData, "urgencyLevel") as QuoteInputs["urgency_level"]) ?? undefined,
    complexity_level:
      (optStr(formData, "complexityLevel") as QuoteInputs["complexity_level"]) ?? undefined,
    cleanup_start_month: optStr(formData, "cleanupStartMonth"),
    cleanup_end_month: optStr(formData, "cleanupEndMonth"),
    cleanup_period_months: optInt(formData, "cleanupPeriodMonths"),
    base_amount: optFloat(formData, "baseAmount"),
    notes: optStr(formData, "notes"),
  };
}

function parseScenario(raw: string): ProposalCatalogScenario | null {
  if (
    raw === ProposalCatalogScenario.MONTHLY_BOOKKEEPING ||
    raw === ProposalCatalogScenario.HISTORICAL_CLEANUP ||
    raw === ProposalCatalogScenario.HOURLY_WORK
  ) {
    return raw;
  }
  return null;
}

export async function previewQuotesAction(formData: FormData): Promise<PackagePreview[]> {
  const { brand } = await requireQuoteStaffOrThrow();
  const scenario = parseScenario(str(formData, "scenario"));
  if (!scenario) throw new Error("Select a service scenario.");
  return previewScenarioQuotes(brand.id, scenario, parseInputs(formData));
}

export async function createQuoteAction(formData: FormData) {
  const { brand } = await requireQuoteStaffOrThrow();

  const existingClientId = str(formData, "existingClientId");
  const clientName = str(formData, "clientName");
  const clientEmail = str(formData, "clientEmail").toLowerCase();
  const clientCompany = optStr(formData, "clientCompany");
  const packageId = str(formData, "packageId");

  if (!packageId) {
    redirect("/offers/new?error=package-required");
  }

  let clientId: string;

  if (existingClientId) {
    const existing = await prisma.quoteClient.findFirst({
      where: { id: existingClientId, brandId: brand.id },
      select: { name: true, email: true, company: true },
    });
    if (!existing) {
      redirect("/offers/new?error=client-required");
    }
    const client = await prisma.quoteClient.create({
      data: {
        brandId: brand.id,
        name: existing.name,
        email: existing.email,
        company: existing.company,
      },
      select: { id: true },
    });
    clientId = client.id;
  } else {
    if (!clientName || !clientEmail) {
      redirect("/offers/new?error=client-required");
    }
    const client = await prisma.quoteClient.create({
      data: {
        brandId: brand.id,
        name: clientName,
        email: clientEmail,
        company: clientCompany,
      },
      select: { id: true },
    });
    clientId = client.id;
  }

  try {
    const result = await buildQuote(brand.id, clientId, packageId, parseInputs(formData));
    revalidatePath("/offers");
    redirect(`/offers/${result.quoteId}?created=1`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect("/offers/new?error=package-required");
  }
}
