import { NextResponse } from "next/server";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { planIntake } from "@/lib/phone-intake/ticket";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireStaffBrandOrThrow();
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "You need to sign in." }, { status: 401 });
    }
    throw error;
  }

  const body = await request.json().catch(() => null);
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const plan = planIntake({
    name: record.name,
    size: record.size,
    type: record.type,
    secret: process.env.PHONE_INTAKE_SECRET ?? "",
    publicUrl: process.env.PHONE_INTAKE_PUBLIC_URL ?? "",
    nowSeconds: Math.floor(Date.now() / 1000),
  });
  if (!plan.ok) return NextResponse.json({ error: plan.error }, { status: plan.status });
  if (process.env.NODE_ENV === "production" && !plan.putUrl.startsWith("https://")) {
    return NextResponse.json({ error: "The secure phone upload address is not set up." }, { status: 503 });
  }
  return NextResponse.json({ putUrl: plan.putUrl, name: plan.name });
}
