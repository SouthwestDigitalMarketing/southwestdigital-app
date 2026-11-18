import { NextResponse } from "next/server";
import { PipeBrandError, resolveBrand } from "@/lib/pipe/contacts";
import { authenticateOperationsRequest, loadBoard } from "@/lib/operations/api";
import { STATE_LABEL } from "@/lib/operations/schedule";

export const dynamic = "force-dynamic";

/** What agents read to find open work: every occurrence in the window and its state. */
export async function GET(request: Request) {
  const auth = authenticateOperationsRequest(request.headers.get("authorization"));
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 503 ? "Operations API is not configured." : "Unauthorized." },
      { status: auth.status },
    );
  }
  const brandSlug = new URL(request.url).searchParams.get("brand")?.trim() ?? "";
  try {
    const brand = await resolveBrand(brandSlug);
    const { clients, items } = await loadBoard(brand.id, new Date());
    return NextResponse.json({
      clients: clients.map(({ key, name, startsOn }) => ({ key, name, startsOn })),
      items: items.map((i) => ({
        duty: i.duty.id,
        title: i.duty.title,
        client: i.client?.key ?? null,
        period: i.period,
        dueAt: i.dueAt.toISOString(),
        state: i.state,
        label: STATE_LABEL[i.state],
        summary: i.evidence?.summary ?? null,
      })),
    });
  } catch (error) {
    if (error instanceof PipeBrandError) return NextResponse.json({ error: error.message }, { status: 404 });
    throw error;
  }
}
