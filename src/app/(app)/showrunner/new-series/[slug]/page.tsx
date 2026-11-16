import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAppBrand } from "@/lib/brands/staff";
import { findSuggestion } from "../../suggestions";

export default async function SeriesPlanPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireAppBrand();
  const { slug } = await params;
  const series = findSuggestion(slug);
  if (!series) notFound();

  return (
    <main className="p-8">
      <Link href="/showrunner/new-series" className="text-sm text-slate-600 underline">Back to suggestions</Link>
      <h1 className="mt-6 text-3xl font-semibold text-slate-900">{series.title}</h1>
      <p className="mt-2 text-slate-600">{series.pitch}</p>

      <section className="mt-6 max-w-xl">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Finale</h2>
        <p className="mt-1 text-slate-900">{series.finale}</p>
        <h2 className="mt-5 text-sm font-semibold uppercase tracking-wide text-slate-500">Then</h2>
        <p className="mt-1 text-slate-900">{series.next}</p>
        <h2 className="mt-5 text-sm font-semibold uppercase tracking-wide text-slate-500">Why Showrunner suggests it</h2>
        <ul className="mt-1 list-disc pl-5 text-slate-900">
          {series.why.map((w) => <li key={w}>{w}</li>)}
        </ul>
      </section>

      <section className="mt-8 max-w-xl">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Season 1: what to film</h2>
        <ol className="mt-3 flex flex-col gap-3">
          {series.episodes.map((e, i) => (
            <li key={e.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="font-semibold text-slate-900">{i + 1}. {e.title}</p>
              <p className="mt-1 text-sm text-slate-700">{e.what}</p>
              <p className="mt-2 text-sm text-slate-500">Where: {e.where}</p>
              <p className="text-sm text-slate-500">Who: {e.who}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-slate-500">A shoot plan, not a script. Say what is real.</p>
      </section>
    </main>
  );
}
