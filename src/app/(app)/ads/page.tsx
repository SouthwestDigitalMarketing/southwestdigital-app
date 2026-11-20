import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireStaffBrand } from "@/lib/brands/staff";
import { BEFORE_GO_LIVE, campaignFromRow, mapLink, type AdCampaign, type AdStatus } from "@/lib/ads/campaigns";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<AdStatus, string> = {
  draft: "Draft · not live",
  running: "Running",
  paused: "Paused",
  ended: "Ended",
};

const STATUS_CLASS: Record<AdStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  running: "bg-emerald-100 text-emerald-700",
  paused: "bg-amber-100 text-amber-700",
  ended: "bg-slate-100 text-slate-500",
};

export default async function AdsPage() {
  const { brand } = await requireStaffBrand();
  const saved = await prisma.adCampaign.findMany({ where: { brandId: brand.id }, orderBy: { createdAt: "desc" } });
  const campaigns = saved.map(campaignFromRow);
  const running = campaigns.filter((campaign) => campaign.status === "running");
  const planned = campaigns.filter((campaign) => campaign.status === "draft");

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-8">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Ads</h1>
          <p className="mt-1 text-sm text-slate-500">What&apos;s running and what&apos;s next</p>
        </div>
        <Link
          href="/ads/new"
          className="ui-action-primary inline-flex items-center justify-center gap-1.5 self-start rounded-lg border px-4 py-2 text-sm font-semibold transition"
        >
          <Plus size={16} /> Create ad
        </Link>
      </div>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Running now</h2>
        {running.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            No ads running.
          </p>
        ) : (
          <div className="mt-2 grid gap-4">
            {running.map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} />)}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Drafts</h2>
        {planned.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            No drafts yet. Use Create ad to start one.
          </p>
        ) : (
          <div className="mt-2 grid gap-4">
            {planned.map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} />)}
          </div>
        )}
      </section>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Before an ad goes live</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
          {BEFORE_GO_LIVE.map((step) => <li key={step}>{step}</li>)}
        </ol>
      </section>
    </div>
  );
}

function CampaignCard({ campaign }: { campaign: AdCampaign }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-slate-900">{campaign.name}</h3>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[campaign.status]}`}>
          {STATUS_LABEL[campaign.status]}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <Field label="Where">{campaign.platform}</Field>
        <Field label="Who sees it">
          {campaign.area}
          <ul className="mt-1 space-y-0.5">
            {campaign.pins.map((pin) => (
              <li key={pin.label}>
                <a href={mapLink(pin)} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline">
                  {pin.label}
                </a>{" "}
                <span className="text-slate-500">· {pin.radiusMiles} mile radius</span>
              </li>
            ))}
          </ul>
        </Field>
        <Field label="Offer">{campaign.offer}</Field>
        {campaign.headline && (
          <Field label="Ad">
            <span className="font-semibold">{campaign.headline}</span>
            {campaign.primaryText && <span className="mt-1 block whitespace-pre-line text-slate-600">{campaign.primaryText}</span>}
            {campaign.callToAction && <span className="mt-1 block text-slate-500">Button: {campaign.callToAction}</span>}
          </Field>
        )}
        <Field label="Landing page">
          <span className="break-all">{campaign.landingPage.replace(/^https?:\/\//, "")}</span>
          {!campaign.landingPageLive && <span className="text-slate-500"> · not built yet</span>}
        </Field>
        <Field label="Daily budget">
          {campaign.dailyBudgetUsd === null ? (
            <span className="text-slate-500">Not set (Tom decides)</span>
          ) : (
            `$${campaign.dailyBudgetUsd.toFixed(2)} a day`
          )}
        </Field>
      </dl>

    </article>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-800">{children}</dd>
    </div>
  );
}
