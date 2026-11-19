import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncServiceTags } from "@/lib/operations/serviceTags";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Nightly, just after midnight in Chicago: records start and end on dates, so
 * service and client tags are re-derived from them every day.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const brands = await prisma.serviceRecord.findMany({ distinct: ["brandId"], select: { brandId: true } });
  const result: Record<string, number> = {};
  for (const { brandId } of brands) {
    result[brandId] = (await syncServiceTags(brandId)).length;
  }
  return NextResponse.json({ changedContacts: result });
}
