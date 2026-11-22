import { NextResponse } from "next/server";
import { checkStatusToken } from "@/lib/showrunner/video-status";
import { parseEpisodes } from "@/lib/showrunner/studio";
import { PipeBrandError, resolveBrand } from "@/lib/pipe/contacts";
import { createBrandDataContext, withBrandDataTransaction } from "@/lib/tenancy/context";

export const dynamic = "force-dynamic";

/** Ripley pulls the locked storyboard. Interview notes never leave SWapp. */
export async function GET(request: Request) {
  const auth = checkStatusToken(request.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });
  const slug = new URL(request.url).searchParams.get("brand")?.trim() ?? "";
  if (!slug) return NextResponse.json({ error: "brand is required" }, { status: 400 });
  let brand;
  try {
    brand = await resolveBrand(slug);
  } catch (error) {
    if (error instanceof PipeBrandError) return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    throw error;
  }
  const context = createBrandDataContext({ brandId: brand.id, actorUserId: auth.actorUserId });
  const row = await withBrandDataTransaction(context, (tx) => tx.showrunnerStudio.findUnique({ where: { brandId: brand.id } }));
  const episode = parseEpisodes(row?.episodes).findLast((item) => item.status === "locked");
  if (!episode) return NextResponse.json({ episode: null });
  return NextResponse.json({
    series: "the-10k-month",
    episode: {
      id: episode.id,
      title: episode.title,
      question: episode.question,
      payoff: episode.payoff,
      hook_next: episode.hook,
      carried_hook: episode.carriedHook,
      storyboard: episode.beats.map((beat, i) => ({ beat: i + 1, name: beat.name, talk: beat.talk, show: beat.show })),
    },
    mountain: { current: row?.mountainCurrent ?? null, show_numbers: row?.showDollars ?? false },
  }, { headers: { "Cache-Control": "private, no-store" } });
}
