import Link from "next/link";
import { SEO_GOAL_KEYWORD, SEO_PLAN, SEO_PLAN_AS_OF, SEO_SCORE } from "@/lib/localSeo/seoPlan";
import { loadLocalSeoData, scanStats } from "./data";

export const dynamic = "force-dynamic";

// The money chain at the top (Tom, 2026-11-28): what has to happen for local search to pay.
const CHAIN = [
  { step: "Someone near Conroe searches \"bookkeeper\"", detail: "On Google or Google Maps, on their phone" },
  { step: "We show in the map's top 3", detail: "Most calls go to those three" },
  { step: "They call or send the form", detail: "Phone (936) 283-4346 or the website" },
  { step: "Tom has the intro call", detail: "Quote and agreement follow" },
  { step: "They sign up monthly", detail: "Recurring fee, every month" },
];

const LEVERS = [
  { title: "Reviews", text: "A few new Google reviews every month, in the client's own words, naming the service and the town." },
  { title: "Profile = website", text: "The Google profile's category, services and products match pages on our site, word for word." },
  { title: "Listings and pages", text: "Same name, address and phone on every directory; a strong page for each service and town." },
];

const fmtDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export default async function LocalSeoOverviewPage() {
  const { scans } = await loadLocalSeoData();
  const latest = scans.find((scan) => scan.status !== "queued" && scan.keywords.includes(SEO_GOAL_KEYWORD));
  const stats = scanStats(latest, SEO_GOAL_KEYWORD);
  const items = SEO_PLAN.flatMap((section) => section.items);
  const done = items.filter((item) => item.status === "done").length;
  const blockers = items.filter((item) => item.blocker && item.status !== "done").slice(0, 4);

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h1 className="text-lg font-semibold text-slate-950">How local search makes us money</h1>
        <p className="mt-1 text-sm text-slate-600">
          <b className="text-slate-900">Goal:</b> be in Google&apos;s top 3 for &ldquo;{SEO_GOAL_KEYWORD}&rdquo; everywhere within about 15 miles of the office,
          so more local owners call us instead of a competitor. Rank is only the means; the score is calls and new monthly clients.
        </p>
        <ol className="mt-4 grid gap-2 sm:grid-cols-5">
          {CHAIN.map((link, index) => (
            <li key={link.step} className="flex items-baseline gap-2 rounded-xl bg-slate-50 px-3 py-2 sm:block sm:p-3">
              <span className="text-xs font-semibold text-slate-400">{index + 1}</span>
              <p className="text-sm font-medium leading-5 text-slate-900">{link.step}</p>
              <p className="mt-0.5 hidden text-xs text-slate-500 sm:block">{link.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-sm font-semibold text-slate-900">What gets us into the top 3</h2>
          <ul className="mt-2 space-y-2">
            {LEVERS.map((lever) => (
              <li key={lever.title} className="text-sm text-slate-600"><b className="text-slate-900">{lever.title}.</b> {lever.text}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">From the Chris Palmer study (211 videos). No paid links, bots or fake reviews.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-sm font-semibold text-slate-900">Scoreboard</h2>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Score
              label={`Top 3 for "${SEO_GOAL_KEYWORD}"`}
              value={stats.topThreeShare === null ? "—" : `${Math.round(stats.topThreeShare * 100)}%`}
              detail={latest ? `${stats.topThree} of ${stats.complete} map points · ${new Date(latest.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : "No scan yet"}
              href="/local-seo/map"
            />
            <Score label="Google reviews" value={String(SEO_SCORE.googleReviews.value)} detail={`As of ${fmtDate(SEO_SCORE.googleReviews.asOf)}; ${SEO_SCORE.googleReviews.note}`} />
            <Score
              label="Real website leads"
              value={String(SEO_SCORE.realFormLeads.value)}
              detail={`Of ${SEO_SCORE.realFormLeads.of} form fills, ${fmtDate(SEO_SCORE.realFormLeads.from)}–${fmtDate(SEO_SCORE.realFormLeads.to)}; ${SEO_SCORE.realFormLeads.note}`}
            />
            <Score label="Plan done" value={`${done} of ${items.length}`} detail={`Checklist as of ${fmtDate(SEO_PLAN_AS_OF)}`} href="/local-seo/plan" />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-amber-950">Holding us back right now</h2>
          <Link href="/local-seo/plan" className="text-xs font-medium text-amber-900 underline underline-offset-4">Full plan</Link>
        </div>
        <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {blockers.map((item) => (
            <li key={item.title} className="text-sm text-amber-950"><b>{item.title}:</b> {item.blocker}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Score({ label, value, detail, href }: { label: string; value: string; detail: string; href?: string }) {
  const body = (
    <>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-xl font-semibold text-slate-950">{value}</p>
      <p className="text-xs leading-4 text-slate-500">{detail}</p>
    </>
  );
  return href
    ? <Link href={href} className="block rounded-xl border border-slate-100 p-3 hover:border-slate-300">{body}</Link>
    : <div className="rounded-xl border border-slate-100 p-3">{body}</div>;
}
