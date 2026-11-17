import { NextResponse } from "next/server";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { collectReadyLocalSeoTasks } from "@/lib/localSeo/provider";

export const dynamic = "force-dynamic";

export async function POST() {
  try { await requireStaffBrandOrThrow(); }
  catch { return NextResponse.json({ error: "Staff access required." }, { status: 403 }); }
  try {
    return NextResponse.json(await collectReadyLocalSeoTasks());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not refresh scan results." }, { status: 502 });
  }
}
