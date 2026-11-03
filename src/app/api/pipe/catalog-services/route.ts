import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/simpleRateLimit";
import { PipeBrandError, authenticatePipeRequest } from "@/lib/pipe/contacts";
import {
  createPipeCatalogService,
  listPipeCatalogServices,
  parsePipeCatalogServiceInput,
  PipeCatalogError,
} from "@/lib/pipe/catalogServices";

export const dynamic = "force-dynamic";

type Guard = { response: NextResponse; actorUserId?: undefined } | { response?: undefined; actorUserId: string };

function guard(request: Request): Guard {
  const auth = authenticatePipeRequest(request.headers.get("authorization"));
  if (!auth.ok) {
    const message = auth.status === 503 ? "Pipe API is not configured." : "Unauthorized.";
    return { response: NextResponse.json({ error: message }, { status: auth.status }) };
  }
  if (!checkRateLimit("pipe-catalog-services", 60, 60_000).allowed) {
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
    const services = await listPipeCatalogServices({
      actorUserId: checked.actorUserId,
      brand,
      includeInactive: url.searchParams.get("includeInactive") === "1",
      query: url.searchParams.get("q") ?? undefined,
    });
    return NextResponse.json({ services });
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
    input = parsePipeCatalogServiceInput(await request.json().catch(() => null));
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
  try {
    const service = await createPipeCatalogService({ actorUserId: checked.actorUserId, input });
    return NextResponse.json({ service }, { status: 201 });
  } catch (error) {
    if (error instanceof PipeBrandError) return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof PipeCatalogError) return NextResponse.json({ error: error.message }, { status: 409 });
    throw error;
  }
}
