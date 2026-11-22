import { requireStaffBrand } from "@/lib/brands/staff";
import { prisma } from "@/lib/prisma";
import { withBrandDataTransaction } from "@/lib/tenancy/context";
import { parseEpisodes } from "@/lib/showrunner/studio";
import {
  detectMilestones,
  parseMilestoneOverrides,
  parseStorylineDrafts,
  resolveMetricsBrand,
  resolveMilestones,
} from "@/lib/showrunner/storylines";
import { StudioClient } from "./StudioClient";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const { dataContext, brand } = await requireStaffBrand();
  const showBrandRow = await prisma.brand.findUnique({
    where: { id: dataContext.brandId },
    select: { id: true, name: true, slug: true },
  });
  const metricsBrand = await resolveMetricsBrand(
    showBrandRow ?? { id: dataContext.brandId, name: "this firm", slug: "" },
  );
  const state = await withBrandDataTransaction(dataContext, async (tx) => {
    const row = await tx.showrunnerStudio.findUnique({
      where: { brandId: dataContext.brandId },
      select: { mountainCurrent: true, showDollars: true, episodes: true, storylines: true, milestoneOverrides: true },
    });
    const auto = await detectMilestones(tx, metricsBrand.id);
    return { row, auto };
  });
  const episodes = parseEpisodes(state?.row?.episodes ?? []);
  const active = [...episodes].reverse().find((episode) => episode.status === "draft" || episode.status === "locked");
  const milestones = resolveMilestones(
    new Map((state?.auto ?? []).map((milestone) => [milestone.key, { done: milestone.done, at: milestone.at }])),
    parseMilestoneOverrides(state?.row?.milestoneOverrides),
  );
  return (
    <StudioClient
      key={`${active?.id ?? "idle"}-${active?.status ?? "home"}-${brand.id}`}
      episodes={episodes}
      storylines={parseStorylineDrafts(state?.row?.storylines ?? [])}
      milestones={milestones}
      metricsBrandName={metricsBrand.name}
      mountainCurrent={state?.row?.mountainCurrent ?? null}
      showDollars={state?.row?.showDollars ?? false}
    />
  );
}
