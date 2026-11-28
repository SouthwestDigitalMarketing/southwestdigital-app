"use server";

import { revalidatePath } from "next/cache";
import { requireAppBrand } from "@/lib/brands/staff";
import { setBridgeEnabled } from "@/lib/operations/bridge";

/** Tom's ON/OFF tap for the ChatGPT bridge (platform operators only). */
export async function toggleBridge(form: FormData) {
  const { session, isPlatformOperator } = await requireAppBrand();
  if (!isPlatformOperator) throw new Error("Unauthorized");
  const enabled = form.get("enabled") === "on";
  await setBridgeEnabled(enabled, session.user.email ?? session.user.id);
  revalidatePath("/settings/bridge");
}
