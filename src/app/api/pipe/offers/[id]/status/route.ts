import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/simpleRateLimit";
import { PipeBrandError, authenticatePipeRequest } from "@/lib/pipe/contacts";
import { PipeOfferError, setPipeOfferStatus } from "@/lib/pipe/offers";

export const dynamic = "force-dynamic";

type Guard = { response: NextResponse; actorUserId?: undefined } | { response?: undefined; actorUserId: string };

function guard(request: Request): Guard {
  const auth = authenticatePipeRequest(request.headers.get("authorization"));
  if (!auth.ok) {
    const message = auth.status === 503 ? "Pipe API is not configured." : "Unauthorized.";
    return { response: NextResponse.json({ error: message }, { status: auth.status }) };
  }
  if (!checkRateLimit("pipe-offers", 60, 60_000).allowed) {
    return { response: NextResponse.json({ error: "Too many requests." }, { status: 429 }) };
  }
  return { actorUserId: auth.actorUserId };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const checked = guard(request);
  if (checked.response) return checked.response;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const brand = (body?.brand as string | undefined)?.trim();
  const status = (body?.status as string | undefined)?.trim();
  if (!brand) return NextResponse.json({ error: "brand is required." }, { status: 400 });
  if (!status) return NextResponse.json({ error: "status is required." }, { status: 400 });
  try {
    const offer = await setPipeOfferStatus({ actorUserId: checked.actorUserId, brand, offerId: id, status });
    return NextResponse.json({ offer });
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof PipeBrandError) return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof PipeOfferError) return NextResponse.json({ error: error.message }, { status: 404 });
    throw error;
  }
}
