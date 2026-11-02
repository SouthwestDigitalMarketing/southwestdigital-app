import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/simpleRateLimit";
import { PipeBrandError, authenticatePipeRequest } from "@/lib/pipe/contacts";
import { createPipeOffer, listPipeOffers, parseCreatePipeOfferInput, PipeOfferError } from "@/lib/pipe/offers";

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

export async function GET(request: Request) {
  const checked = guard(request);
  if (checked.response) return checked.response;
  const url = new URL(request.url);
  const brand = url.searchParams.get("brand")?.trim();
  if (!brand) return NextResponse.json({ error: "brand is required." }, { status: 400 });
  try {
    const offers = await listPipeOffers({
      actorUserId: checked.actorUserId,
      brand,
      status: url.searchParams.get("status") ?? undefined,
      query: url.searchParams.get("q") ?? undefined,
    });
    return NextResponse.json({ offers });
  } catch (error) {
    if (error instanceof PipeBrandError) return NextResponse.json({ error: error.message }, { status: 404 });
    throw error;
  }
}

export async function POST(request: Request) {
  const checked = guard(request);
  if (checked.response) return checked.response;
  let input;
  try {
    input = parseCreatePipeOfferInput(await request.json().catch(() => null));
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
  try {
    const offer = await createPipeOffer({ actorUserId: checked.actorUserId, input });
    return NextResponse.json({ offer }, { status: 201 });
  } catch (error) {
    if (error instanceof PipeBrandError) return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof PipeOfferError) return NextResponse.json({ error: error.message }, { status: 422 });
    throw error;
  }
}
