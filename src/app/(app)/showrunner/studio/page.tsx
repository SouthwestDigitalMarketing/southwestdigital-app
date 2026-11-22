import { requireStaffBrand } from "@/lib/brands/staff";
import { withBrandDataTransaction } from "@/lib/tenancy/context";
import { parseEpisodes } from "@/lib/showrunner/studio";
import { StudioClient } from "./StudioClient";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const { dataContext, brand, session } = await requireStaffBrand();
  const state = await withBrandDataTransaction(dataContext, (tx) =>
    tx.showrunnerStudio.findUnique({
      where: { brandId: dataContext.brandId },
      select: { mountainCurrent: true, showDollars: true, episodes: true },
    }),
  );
  const episodes = parseEpisodes(state?.episodes ?? []);
  const active = [...episodes].reverse().find((episode) => episode.status === "draft" || episode.status === "locked");
  return (
    <StudioClient
      key={`${active?.id ?? "idle"}-${active?.status ?? "home"}`}
      episodes={episodes}
      mountainCurrent={state?.mountainCurrent ?? null}
      showDollars={state?.showDollars ?? false}
      interviewStorageKey={`showrunner-studio-interview:${brand.id}:${session.user.id}`}
    />
  );
}
