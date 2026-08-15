"use server";

import { BrandRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { createContact } from "@/lib/crm/repository";
import { requireActiveBrandContext } from "@/lib/tenancy/current";

export async function createContactAction(formData: FormData) {
  const { dataContext } = await requireActiveBrandContext({ minimumRole: BrandRole.MEMBER });
  await createContact(dataContext, {
    displayName: formData.get("displayName"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phoneNumber: formData.get("phoneNumber"),
    roleTitle: formData.get("roleTitle"),
    marketingConsent: formData.get("marketingConsent"),
    marketingConsentSource: "portal-manual-entry",
  });
  revalidatePath("/portal/contacts");
}
