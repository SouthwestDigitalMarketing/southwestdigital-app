import { NextResponse } from "next/server";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { prisma } from "@/lib/prisma";
import { DEFAULT_GRID, DEFAULT_KEYWORDS, parseGridSettings, SPACING_OPTIONS } from "@/lib/localSeo/grid";

export const dynamic = "force-dynamic";

const defaults = { ...DEFAULT_GRID, keywords: DEFAULT_KEYWORDS };

export async function GET() {
  try {
    const { brand } = await requireStaffBrandOrThrow();
    const config = await prisma.localSeoConfig.findUnique({ where: { brandId: brand.id } });
    return NextResponse.json({ settings: config ?? defaults });
  } catch {
    return NextResponse.json({ error: "Staff access required." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const { brand } = await requireStaffBrandOrThrow();
    const settings = parseGridSettings(await request.json().catch(() => null));
    if (!settings) return NextResponse.json({ error: `Use an odd grid from 3 to 9, spacing of ${SPACING_OPTIONS.join(", ")} miles, and 1 to 12 keywords.` }, { status: 400 });
    const saved = await prisma.localSeoConfig.upsert({
      where: { brandId: brand.id },
      create: { brandId: brand.id, ...settings },
      update: settings,
    });
    return NextResponse.json({ settings: saved });
  } catch {
    return NextResponse.json({ error: "Staff access required." }, { status: 403 });
  }
}
