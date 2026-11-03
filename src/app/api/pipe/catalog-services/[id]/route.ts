import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/simpleRateLimit";
import { PipeBrandError, authenticatePipeRequest } from "@/lib/pipe/contacts";
import {
  archivePipeCatalogService,
  parsePipeCatalogServiceInput,
  updatePipeCatalogService,
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

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const checked = guard(request);
  if (checked.response) return checked.response;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const brand = (body?.brand as string | undefined)?.trim();
  if (!brand) return NextResponse.json({ error: "brand is required." }, { status: 400 });

  // Reuse the create parser for validation, then keep only the keys the caller sent
  // so an omitted field means "leave as-is" rather than "reset to default".
  let parsed;
  try {
    parsed = parsePipeCatalogServiceInput({ ...body, name: body?.name ?? "placeholder" });
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }

  const patch: Record<string, unknown> = {};
  for (const key of [
    "name",
    "code",
    "clientBenefit",
    "internalDescription",
    "applicabilityNote",
    "defaultInclusion",
    "offerSection",
    "defaultPrice",
    "billingCadence",
    "defaultPackageKeys",
    "priority",
  ] as const) {
    if (body && Object.prototype.hasOwnProperty.call(body, key)) patch[key] = parsed[key];
  }

  try {
    const service = await updatePipeCatalogService({
      actorUserId: checked.actorUserId,
      brand,
      id,
      patch,
    });
    return NextResponse.json({ service });
  } catch (error) {
    if (error instanceof PipeBrandError) return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof PipeCatalogError) return NextResponse.json({ error: error.message }, { status: 404 });
    throw error;
  }
}

/** Archives (active = false). Catalogue rows are never hard-deleted; offers reference them. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const checked = guard(request);
  if (checked.response) return checked.response;
  const { id } = await params;
  const brand = new URL(request.url).searchParams.get("brand")?.trim();
  if (!brand) return NextResponse.json({ error: "brand is required." }, { status: 400 });
  try {
    const service = await archivePipeCatalogService({ actorUserId: checked.actorUserId, brand, id });
    return NextResponse.json({ service, archived: true });
  } catch (error) {
    if (error instanceof PipeBrandError) return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof PipeCatalogError) return NextResponse.json({ error: error.message }, { status: 404 });
    throw error;
  }
}
