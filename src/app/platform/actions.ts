"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addPendingBrandDomain,
  createBrandOnboarding,
  inviteBrandMember,
  updateBrandTheme,
} from "@/lib/platform/repository";
import { requirePlatformAdministrator } from "@/lib/platform/authorization";

export async function createBrandOnboardingAction(formData: FormData) {
  const { session } = await requirePlatformAdministrator();
  const brand = await createBrandOnboarding(session.user.id, {
    name: formData.get("name"),
    legalName: formData.get("legalName"),
    slug: formData.get("slug"),
    appHostname: formData.get("appHostname"),
    ownerName: formData.get("ownerName"),
    ownerEmail: formData.get("ownerEmail"),
    logoUrl: formData.get("logoUrl"),
    supportEmail: formData.get("supportEmail"),
    primaryColor: formData.get("primaryColor"),
    accentColor: formData.get("accentColor"),
    backgroundColor: formData.get("backgroundColor"),
    foregroundColor: formData.get("foregroundColor"),
  });

  revalidatePath("/platform/brands");
  redirect(`/platform/brands/${brand.id}`);
}

export async function addPendingBrandDomainAction(formData: FormData) {
  const { session } = await requirePlatformAdministrator();
  const brandId = formData.get("brandId");
  await addPendingBrandDomain(session.user.id, {
    brandId,
    hostname: formData.get("hostname"),
    purpose: formData.get("purpose"),
  });
  revalidatePath(`/platform/brands/${brandId}`);
}

export async function updateBrandThemeAction(formData: FormData) {
  const { session } = await requirePlatformAdministrator();
  const brandId = formData.get("brandId");
  await updateBrandTheme(session.user.id, {
    brandId,
    logoUrl: formData.get("logoUrl"),
    supportEmail: formData.get("supportEmail"),
    primaryColor: formData.get("primaryColor"),
    accentColor: formData.get("accentColor"),
    backgroundColor: formData.get("backgroundColor"),
    foregroundColor: formData.get("foregroundColor"),
  });
  revalidatePath(`/platform/brands/${brandId}`);
}

export async function inviteBrandMemberAction(formData: FormData) {
  const { session } = await requirePlatformAdministrator();
  const brandId = formData.get("brandId");
  await inviteBrandMember(session.user.id, {
    brandId,
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
  });
  revalidatePath(`/platform/brands/${brandId}`);
}
