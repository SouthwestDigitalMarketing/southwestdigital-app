import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/simpleRateLimit";
import { authenticateOperationsRequest } from "@/lib/operations/api";
import { bridgeView, loadBridge, parseBridgeReport, recordBridgeReport } from "@/lib/operations/bridge";

export const dynamic = "force-dynamic";

function denied(request: Request) {
  const auth = authenticateOperationsRequest(request.headers.get("authorization"));
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 503 ? "Operations API is not configured." : "Unauthorized." },
      { status: auth.status },
    );
  }
  if (!checkRateLimit("operations-bridge", 30, 60_000).allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  return null;
}

/** The switch and ripley's last report, for agents (bridgectl status). */
export async function GET(request: Request) {
  const no = denied(request);
  if (no) return no;
  return NextResponse.json(bridgeView(await loadBridge()));
}

/**
 * ripley's heartbeat, every ~30 s and on each mode change:
 * { mode, lastCheckAt?, lastMessageAt?, lastMessageUid?, lastError?, reportedBy?, turnOff? }.
 * Answers { enabled }: the switch ripley must follow. turnOff: true lets an agent switch it OFF
 * (never on; on is Tom's tap in /settings/bridge).
 */
export async function POST(request: Request) {
  const no = denied(request);
  if (no) return no;
  const report = parseBridgeReport((await request.json().catch(() => null)) as Record<string, unknown> | null);
  if (typeof report === "string") return NextResponse.json({ error: report }, { status: 400 });
  return NextResponse.json(await recordBridgeReport(report));
}
