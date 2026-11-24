import Link from "next/link";
import { requireAppBrand } from "@/lib/brands/staff";
import { loadWeek } from "@/lib/showrunner/load";
import { clipLength, releaseLabel } from "@/lib/showrunner/weekly";

export const dynamic = "force-dynamic";

/**
 * The Sunday wrap-up (Tom, 2026-11-24): the week's numbers and Tom's talking points, written by
 * ripley from our records. He films a host part from them, opening with "Sunday wrap-up", and the
 * autopilot cuts in the clips below and schedules it for 5 PM Central.
 */
export default async function SundayPage() {
  const { dataContext } = await requireAppBrand();
  const week = await loadWeek(dataContext);

  if (!week) {
    return (
      <div className="p-4 sm:p-8">
        <h1 className="text-2xl font-semibold text-slate-900">Sunday wrap-up</h1>
        <p className="mt-2 max-w-xl text-slate-600">
          Nothing gathered yet. Every Saturday at 9 AM Central, Showrunner counts the week and writes your talking points here.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <Link href="/showrunner/series" className="text-sm font-semibold text-slate-500">← Series</Link>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">{week.title || "Sunday wrap-up"}</h1>
      <p className="mt-1 text-slate-600">Airs {releaseLabel(week.release)} Central</p>

      <div className="mt-5 max-w-xl rounded-2xl bg-slate-900 p-5 text-white">
        <p className="text-xs font-semibold uppercase tracking-wide text-rose-300">How to film it</p>
        <p className="mt-2 text-sm text-slate-200">
          Start with &ldquo;Sunday wrap-up&rdquo;, say the points below in your own words, then send it from your phone like any video.
          Clips from the week get cut in for you.
        </p>
      </div>

      <h2 className="mt-6 text-lg font-semibold text-slate-900">Say this</h2>
      {week.question ? <p className="mt-1 text-sm text-slate-500">This week&apos;s question: {week.question}</p> : null}
      <ol className="mt-3 flex max-w-xl list-decimal flex-col gap-3 pl-6 text-lg text-slate-900">
        {week.talkingPoints.map((point, i) => (
          <li key={i}>{point}</li>
        ))}
      </ol>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">The week in numbers</h2>
      <div className="mt-3 grid max-w-xl grid-cols-2 gap-3">
        {week.facts.map((fact) => (
          <div key={fact.key || fact.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{fact.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{fact.value}</p>
            <p className="mt-1 text-xs text-slate-400">{fact.source}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">Clips that get cut in</h2>
      {week.clips.length === 0 ? (
        <p className="mt-2 max-w-xl text-sm text-slate-500">
          No daily videos out this week yet. Clips are picked from the daily videos published before Saturday.
        </p>
      ) : (
        <ul className="mt-3 flex max-w-xl flex-col gap-2">
          {week.clips.map((clip, i) => (
            <li key={i} className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-sm font-semibold text-slate-900">{clip.title}</p>
              <p className="text-xs text-slate-500">{clipLength(clip)} · {clip.why}</p>
            </li>
          ))}
        </ul>
      )}

      {week.hookNext ? <p className="mt-6 max-w-xl text-sm text-slate-600">Next week&apos;s hook: {week.hookNext}</p> : null}
      {week.preparedAt ? (
        <p className="mt-4 text-xs text-slate-400">
          Gathered {new Date(week.preparedAt).toLocaleString("en-US", { timeZone: "America/Chicago" })}
        </p>
      ) : null}
    </div>
  );
}
