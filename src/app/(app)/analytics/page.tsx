import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveBrand } from "@/lib/brands/resolve";
import { MembershipStatus } from "@prisma/client";
import { getTrafficTrend } from "@/lib/analytics/ga4";
import { getDailyViews } from "@/lib/youtube/analytics";
import { YouTubeViewsGraph } from "./YouTubeViewsGraph";
import { WebsiteTrafficGraph } from "./WebsiteTrafficGraph";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const headersList = await headers();
  const resolved = await resolveBrand(headersList.get("x-hostname"), session.user.id);
  if (!resolved?.membership || resolved.membership.status !== MembershipStatus.ACTIVE) {
    redirect("/dashboard");
  }

  const { brand } = resolved;

  const theme = await prisma.brandTheme.findUnique({
    where: { brandId: brand.id },
    select: {
      ga4PropertyId: true,
      ga4HostName: true,
      youtubeChannelId: true,
      monthlyViewsGoal: true,
      monthlyClicksGoal: true,
      primaryColor: true,
    },
  });

  const windowEnd = new Date();
  const windowEndStr = windowEnd.toISOString().slice(0, 10);
  const windowStartStr = new Date(windowEnd.getTime() - 29 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const windowDates: string[] = Array.from({ length: 30 }, (_, i) =>
    new Date(windowEnd.getTime() - (29 - i) * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10),
  );

  // Website traffic from GA4
  type TrafficRow = { date: string; sessions: number; activeUsers: number };
  let websiteRows: TrafficRow[] = [];
  const ga4PropertyId = theme?.ga4PropertyId;
  const ga4HostName = theme?.ga4HostName;
  if (ga4PropertyId) {
    try {
      const raw = await getTrafficTrend(ga4PropertyId, windowStartStr, windowEndStr, ga4HostName);
      const byDate = new Map(raw.map((r) => [r.date, r]));
      websiteRows = windowDates.map((date) => {
        const found = byDate.get(date);
        return { date, sessions: found?.sessions ?? 0, activeUsers: found?.activeUsers ?? 0 };
      });
    } catch (err) {
      console.error("[analytics] GA4 error:", err);
    }
  }

  // YouTube daily views
  type ViewRow = { date: string; views: number };
  let ytRows: ViewRow[] = [];
  const ytChannelId = theme?.youtubeChannelId;
  const slugEnvKey = `YOUTUBE_REFRESH_TOKEN_${brand.slug.toUpperCase().replace(/-/g, "_")}`;
  const ytRefreshToken = process.env[slugEnvKey]?.trim();
  if (ytChannelId && ytRefreshToken) {
    try {
      const raw = await getDailyViews(ytChannelId, ytRefreshToken, windowStartStr, windowEndStr);
      const byDate = new Map(raw.map((r) => [r.date, r.views]));
      ytRows = windowDates.map((date) => ({ date, views: byDate.get(date) ?? 0 }));
    } catch (err) {
      console.error("[analytics] YouTube error:", err);
    }
  }

  const barColor = theme?.primaryColor ?? "#17324d";
  const monthlyViewsGoal = theme?.monthlyViewsGoal ?? 10000;
  const monthlyTrafficGoal = theme?.monthlyClicksGoal ?? 1000;

  return (
    <div className="p-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Analytics</h1>
        <p className="mt-1 text-sm text-slate-500">Website traffic and YouTube performance</p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {ytChannelId ? (
          <YouTubeViewsGraph rows={ytRows} monthlyGoal={monthlyViewsGoal} barColor={barColor} />
        ) : (
          <NotConfiguredCard title="YouTube views" hint="Set youtubeChannelId on BrandTheme and add YOUTUBE_REFRESH_TOKEN env var to enable." />
        )}

        {ga4PropertyId ? (
          <WebsiteTrafficGraph rows={websiteRows} barColor={barColor} monthlyGoal={monthlyTrafficGoal} />
        ) : (
          <NotConfiguredCard title="Website traffic" hint="Set ga4PropertyId on BrandTheme and add Google service account env vars to enable." />
        )}
      </div>
    </div>
  );
}

function NotConfiguredCard({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-3 text-sm text-slate-400">{hint}</p>
    </div>
  );
}
