import { getSourceTagClicksCumulative } from "@/lib/cloudflare/clickSnapshots";
import { getSourceTagVideos } from "@/lib/youtube/sourceTagVideos";
import { monthRange } from "@/lib/showrunner/month";
import { LinkClicksTable } from "../../LinkClicksTable";
import { Missing, Stat, reportChannel } from "./shared";

/** Clicks on the links in the video descriptions during the month, by video. */
export async function LinksSection({ month }: { month: string }) {
  const range = monthRange(month, new Date());
  const { links, theme, channelId, refreshToken, redirectDomain } = await reportChannel();
  if (!redirectDomain) return <Missing>No link domain is set, so clicks are not tracked.</Missing>;
  const until = range.current ? undefined : range.to.toISOString().slice(0, 10);
  const got = await Promise.all([
    getSourceTagClicksCumulative(links.id, links.slug, range.start, until),
    channelId && refreshToken ? getSourceTagVideos(channelId, refreshToken, redirectDomain, links.slug) : Promise.resolve(new Map()),
  ]).then(([report, videos]) => ({ report, videos, error: null }), (error: unknown) => ({ report: null, videos: new Map(), error }));
  if (!got.report) {
    return <Missing>Click tracking did not answer: {got.error instanceof Error ? got.error.message : String(got.error)}</Missing>;
  }
  const goal = theme?.monthlyClicksGoal ?? null;
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Link clicks" value={got.report.totalClicks.toLocaleString("en-US")} note={goal ? `goal ${goal.toLocaleString("en-US")}` : undefined} />
        <Stat label="Videos clicked" value={String(got.report.byTag.length)} />
      </div>
      <LinkClicksTable report={got.report} sourceTagMap={got.videos} redirectDomain={redirectDomain} />
    </div>
  );
}
