"use server";

import { revalidatePath } from "next/cache";
import { createCustomerAccount } from "@/lib/crm/repository";
import { requireActiveBrandContext } from "@/lib/tenancy/current";

export async function createCustomerAccountAction(formData: FormData) {
  const { dataContext } = await requireActiveBrandContext();
  await createCustomerAccount(dataContext, {
    name: formData.get("name"),
    code: formData.get("code"),
    legalName: formData.get("legalName"),
    status: formData.get("status"),
    websiteUrl: formData.get("websiteUrl"),
    entityType: formData.get("entityType"),
    principalAddressLine1: formData.get("principalAddressLine1"),
    principalAddressLine2: formData.get("principalAddressLine2"),
    principalAddressCity: formData.get("principalAddressCity"),
    principalAddressRegion: formData.get("principalAddressRegion"),
    principalAddressPostalCode: formData.get("principalAddressPostalCode"),
    principalAddressCountryCode: formData.get("principalAddressCountryCode"),
    primaryPhone: formData.get("primaryPhone"),
    communicationEmail: formData.get("communicationEmail"),
    noticesEmail: formData.get("noticesEmail"),
    invoicingEmail: formData.get("invoicingEmail"),
  });
  revalidatePath("/portal/customers");
}
