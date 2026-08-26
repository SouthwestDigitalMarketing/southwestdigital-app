import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";

export async function POST(request: Request) {
  try {
    const { brand } = await requireStaffBrandOrThrow();

    const body = (await request.json().catch(() => null)) as {
      clientName?: unknown;
      primaryContactName?: unknown;
      primaryContactEmail?: unknown;
      assessment?: unknown;
      contactInfo?: unknown;
      hasCleanup?: unknown;
    } | null;

    const clientName = typeof body?.clientName === "string" ? body.clientName.trim() : "";
    const primaryContactName = typeof body?.primaryContactName === "string" ? body.primaryContactName.trim() : null;
    const primaryContactEmail = typeof body?.primaryContactEmail === "string" ? body.primaryContactEmail.trim() : null;
    const hasCleanup = Boolean(body?.hasCleanup);

    if (!clientName) {
      return NextResponse.json({ error: "Client name is required." }, { status: 400 });
    }

    const proposalBuilderState = {
      assessment: body?.assessment ?? null,
      contactInfo: body?.contactInfo ?? null,
      hasCleanup,
      version: 1,
      createdAt: new Date().toISOString(),
    };

    const engagement = await prisma.engagement.create({
      data: {
        brandId: brand.id,
        clientName,
        primaryContactName,
        primaryContactEmail,
        status: "SENT_TO_CLIENT",
        onboardingData: { proposalBuilderState } as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    return NextResponse.json({ engagementId: engagement.id });
  } catch (error) {
    console.error("[proposal/create]", error);
    return NextResponse.json({ error: "Could not create proposal." }, { status: 500 });
  }
}
