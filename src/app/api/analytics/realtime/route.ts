import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getRealtimeUsers } from "@/lib/analytics/ga4";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const propertyId = req.nextUrl.searchParams.get("propertyId");
  if (!propertyId) {
    return NextResponse.json({ error: "propertyId required" }, { status: 400 });
  }

  try {
    const data = await getRealtimeUsers(propertyId);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[realtime] GA4 error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
