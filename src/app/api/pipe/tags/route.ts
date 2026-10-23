import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/simpleRateLimit";
import { PipeBrandError, authenticatePipeRequest } from "@/lib/pipe/contacts";
import {
  PipeTagNotFoundError,
  applyPipeTag,
  listPipeContactTags,
  parsePipeTagInput,
} from "@/lib/pipe/tags";

export const dynamic = "force-dynamic";

type Guard = { response: NextResponse; actorUserId?: undefined } | { response?: undefined; actorUserId: string };

function guard(request: Request): Guard {
  const auth = authenticatePipeRequest(request.headers.get("authorization"));
  if (!auth.ok) {
    const message = auth.status === 503 ? "Pipe API is not configured." : "Unauthorized.";
    return { response: NextResponse.json({ error: message }, { status: auth.status }) };
  }
  if (!checkRateLimit("pipe-tags", 120, 60_000).allowed) {
    return { response: NextResponse.json({ error: "Too many requests." }, { status: 429 }) };
  }
  return { actorUserId: auth.actorUserId };
}

function failure(error: unknown) {
  if (error instanceof PipeBrandError || error instanceof PipeTagNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  throw error;
}

export async function GET(request: Request) {
  const checked = guard(request);
  if (checked.response) return checked.response;
  const url = new URL(request.url);
  const brand = url.searchParams.get("brand")?.trim();
  const contactId = url.searchParams.get("contactId")?.trim();
  if (!brand || !contactId) return NextResponse.json({ error: "brand and contactId are required." }, { status: 400 });
  try {
    const tags = await listPipeContactTags({ actorUserId: checked.actorUserId, brand, contactId });
    return NextResponse.json({ tags });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  const checked = guard(request);
  if (checked.response) return checked.response;
  let input;
  try {
    input = parsePipeTagInput(await request.json().catch(() => null));
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
  try {
    const result = await applyPipeTag({ actorUserId: checked.actorUserId, input });
    return NextResponse.json(result, { status: result.tagCreated ? 201 : 200 });
  } catch (error) {
    return failure(error);
  }
}
