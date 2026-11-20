import { NextResponse } from "next/server";
import { PipeBrandError, resolveBrand } from "@/lib/pipe/contacts";
import { authenticateOperationsRequest } from "@/lib/operations/api";
import { GSA_STEPS, type GsaStep } from "@/lib/gsa/progress";
import { GsaError, paidAwaitingGsa, setGsaStep } from "@/lib/gsa/store";
import { createBrandDataContext } from "@/lib/tenancy/context";

export const dynamic = "force-dynamic";

const FOLDER = /^[a-z0-9][a-z0-9_-]{0,80}$/;

function unauthorized(status: number) {
  return NextResponse.json({ error: status === 503 ? "Operations API is not configured." : "Unauthorized." }, { status });
}

async function contextFor(brandSlug: string) {
  const actorUserId = process.env.PIPE_API_ACTOR_USER_ID ?? "";
  if (!actorUserId) throw new GsaError("PIPE_API_ACTOR_USER_ID is not set.");
  const brand = await resolveBrand(brandSlug);
  return createBrandDataContext({ brandId: brand.id, actorUserId });
}

function failure(error: unknown) {
  if (error instanceof PipeBrandError || error instanceof GsaError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  throw error;
}

/** GET ?brand=<slug>: paid proposal agreements whose GSA is not signed yet. */
export async function GET(request: Request) {
  const auth = authenticateOperationsRequest(request.headers.get("authorization"));
  if (!auth.ok) return unauthorized(auth.status);
  try {
    const context = await contextFor(new URL(request.url).searchParams.get("brand")?.trim() ?? "");
    const awaiting = await paidAwaitingGsa(context);
    return NextResponse.json({
      awaiting: awaiting.map((p) => ({
        engagementId: p.engagementId, clientName: p.clientName, tier: p.paid.tier, amount: p.paid.amount,
        paidAt: p.paid.paidAt, gsaDraftedAt: p.gsaDraftedAt, gsaSentAt: p.gsaSentAt, folder: p.gsaClientFolder,
      })),
    });
  } catch (error) {
    return failure(error);
  }
}

/**
 * POST { brand, engagementId, step: drafted|sent|signed, done?: true, at?: ISO date, folder?: ripley folder }:
 * marks a GSA step (or clears it with done: false). Used by Kassad's contract
 * tools and the signed-contract patrol; staff use the GSA panel instead.
 */
export async function POST(request: Request) {
  const auth = authenticateOperationsRequest(request.headers.get("authorization"));
  if (!auth.ok) return unauthorized(auth.status);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const engagementId = typeof body?.engagementId === "string" ? body.engagementId.trim() : "";
  const step = body?.step as GsaStep;
  if (!engagementId || !GSA_STEPS.includes(step)) {
    return NextResponse.json({ error: "engagementId and step (drafted, sent or signed) are required." }, { status: 400 });
  }
  const at = typeof body?.at === "string" ? new Date(body.at) : undefined;
  if (at && Number.isNaN(at.getTime())) return NextResponse.json({ error: "at must be an ISO date." }, { status: 400 });
  const folder = body?.folder === undefined ? undefined : typeof body.folder === "string" && FOLDER.test(body.folder) ? body.folder : null;
  if (body?.folder !== undefined && folder === null && body.folder !== null) {
    return NextResponse.json({ error: "folder must be a ripley client folder name." }, { status: 400 });
  }
  try {
    const context = await contextFor(typeof body?.brand === "string" ? body.brand.trim() : "");
    await setGsaStep(context, { engagementId, step, done: body?.done !== false, at, folder });
    return NextResponse.json({ ok: true, engagementId, step, done: body?.done !== false });
  } catch (error) {
    return failure(error);
  }
}
