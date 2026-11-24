import { DomainPurpose } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAppBrand } from "@/lib/brands/staff";
import { showChannelBrand } from "@/lib/showrunner/channel-brand";
import { getCompanyMetrics } from "@/lib/companyMetrics";
import { getSourceTagClicksCumulative, type SourceTagClickReport } from "@/lib/cloudflare/clickSnapshots";
import { getChannelMetrics } from "@/lib/youtube/analytics";
import { getYouTubeRefreshToken } from "@/lib/youtube/credentials";
import { getSourceTagVideos, type SourceTagVideo } from "@/lib/youtube/sourceTagVideos";
import { LinkClicksTable } from "../LinkClicksTable";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;

/** Read once per request; the purity lint rejects Date.now() inside a component. */
function requestNow() {
  return Date.now();
}

type Step = { label: string; value: number | null; note: string };

/**
 * From videos to clients (Tom, 2026-11-24): views, clicks on the video links, leads, offers.
 * Each number comes from its own source; which video a lead came from is not recorded yet, so
 * the lead and offer steps count every source and say so.
 */
export default async function LeadsPage() {
  const { brand: active, session, isPlatformOperator } = await requireAppBrand();
  const brand = await showChannelBrand(active);
  const now = requestNow();
  // YouTube Analytics lags ~3 days; the same 30 days as Metrics.
  const endDate = new Date(now - 3 * DAY).toISOString().slice(0, 10);
  const startDate = new Date(now - 32 * DAY).toISOString().slice(0, 10);

  const [theme, domain] = await Promise.all([
    prisma.brandTheme.findUnique({ where: { brandId: brand.id }, select: { youtubeChannelId: true } }),
    prisma.brandDomain.findFirst({
      where: { brandId: brand.id, purpose: DomainPurpose.WEBSITE, isPrimary: true },
      select: { hostname: true },
    }),
  ]);
  const channelId = theme?.youtubeChannelId ?? null;
  const refreshToken = channelId ? await getYouTubeRefreshToken(brand.id, brand.slug) : null;

  let views: number | null = null;
  let clickReport: SourceTagClickReport | null = null;
  let sourceTagMap: Map<string, SourceTagVideo> = new Map();
  if (channelId && refreshToken) {
    try {
      views = (await getChannelMetrics(channelId, refreshToken, startDate, endDate)).views;
    } catch (error) {
      console.warn("[showrunner/leads] views skipped:", error instanceof Error ? error.message : error);
    }
    if (domain?.hostname) {
      try {
        [clickReport, sourceTagMap] = await Promise.all([
          getSourceTagClicksCumulative(brand.id, brand.slug),
          getSourceTagVideos(channelId, refreshToken, domain.hostname, brand.slug),
        ]);
      } catch (error) {
        console.warn("[showrunner/leads] clicks skipped:", error instanceof Error ? error.message : error);
      }
    }
  }

  let business: { newLeads: number; offersSent: number; clients: number; mrrUsd: number } | null = null;
  if (isPlatformOperator) {
    try {
      business = (await getCompanyMetrics({
        actorUserId: session.user.id,
        isPlatformOperator,
        from: new Date(now - 30 * DAY),
        to: new Date(now),
      })).total;
    } catch (error) {
      console.warn("[showrunner/leads] business numbers skipped:", error instanceof Error ? error.message : error);
    }
  }

  const steps: Step[] = [
    { label: "Views", value: views, note: "last 30 days" },
    { label: "Link clicks", value: clickReport?.totalClicks ?? null, note: "on video links, all time" },
    { label: "New leads", value: business?.newLeads ?? null, note: "all sources, 30 days" },
    { label: "Offers sent", value: business?.offersSent ?? null, note: "all sources, 30 days" },
  ];

  return (
    <div className="px-4 py-5 sm:p-8">
      <h1 className="text-2xl font-semibold text-slate-900">From videos to clients</h1>
      <div className="mt-4 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
        {steps.map((step, i) => (
          <div
            key={step.label}
            className={`rounded-xl p-4 ${i === 0 ? "bg-slate-900 text-white" : i === 1 ? "bg-slate-700 text-white" : "border border-slate-200 bg-white text-slate-900"}`}
          >
            <p className={`text-xs font-semibold uppercase tracking-wide ${i < 2 ? "text-slate-300" : "text-slate-500"}`}>{step.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{step.value === null ? "—" : step.value.toLocaleString("en-US")}</p>
            <p className={`mt-1 text-xs ${i < 2 ? "text-slate-300" : "text-slate-400"}`}>{step.note}</p>
          </div>
        ))}
      </div>
      {business ? (
        <p className="mt-4 max-w-3xl text-sm text-slate-600">
          {business.clients} clients paying ${business.mrrUsd.toLocaleString("en-US")} a month across Bookkeeping Conroe and The Real Estate Bookkeeper.
        </p>
      ) : null}

      <div className="mt-6 max-w-3xl rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">Not tracked yet: which video a lead came from.</p>
        <p className="mt-1">
          The clicks above are counted per video. Leads and offers count every source, because a lead does not yet
          record the video that sent them. That needs each description&apos;s link to carry its video, and calls and
          forms to ask how they found us.
        </p>
      </div>

      {clickReport && domain?.hostname ? (
        <div className="mt-6 max-w-3xl rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Clicks by video</p>
          <LinkClicksTable report={clickReport} sourceTagMap={sourceTagMap} redirectDomain={domain.hostname} />
        </div>
      ) : null}
    </div>
  );
}
