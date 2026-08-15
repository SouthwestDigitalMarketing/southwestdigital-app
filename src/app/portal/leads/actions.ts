"use server";

import { BrandRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { createLead } from "@/lib/crm/repository";
import { requireActiveBrandContext } from "@/lib/tenancy/current";

function optionalFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value : undefined;
}

export async function createLeadAction(formData: FormData) {
  const { dataContext } = await requireActiveBrandContext({ minimumRole: BrandRole.MEMBER });
  const attribution = {
    source: optionalFormValue(formData, "utmSource"),
    medium: optionalFormValue(formData, "utmMedium"),
    campaign: optionalFormValue(formData, "utmCampaign"),
    landingPageUrl: optionalFormValue(formData, "landingPageUrl"),
    fbclid: optionalFormValue(formData, "fbclid"),
    gclid: optionalFormValue(formData, "gclid"),
  };
  const hasAttribution = Object.values(attribution).some(Boolean);

  await createLead(dataContext, {
    name: formData.get("name"),
    company: formData.get("company"),
    email: formData.get("email"),
    phoneE164: formData.get("phoneE164"),
    source: formData.get("source"),
    sourceDetail: formData.get("sourceDetail"),
    expectedServices: formData.get("expectedServices"),
    notes: formData.get("notes"),
    estimatedValue: formData.get("estimatedValue"),
    valueCurrency: formData.get("valueCurrency"),
    attribution: hasAttribution ? attribution : undefined,
  });
  revalidatePath("/portal/leads");
}
