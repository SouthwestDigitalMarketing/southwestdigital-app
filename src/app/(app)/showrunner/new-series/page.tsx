import Link from "next/link";
import { requireAppBrand } from "@/lib/brands/staff";
import { SUGGESTIONS } from "../suggestions";

export default async function NewSeriesPage() {
  await requireAppBrand();

  return (
    <main className="p-8">
      <Link href="/showrunner" className="text-sm text-slate-600 underline">Back to Showrunner</Link>
      <h1 className="mt-6 text-3xl font-semibold text-slate-900">New series</h1>
      <p className="mt-2 text-slate-600">Showrunner suggests these, from your channel and your business.</p>
      <div className="mt-6 flex max-w-xl flex-col gap-4">
        {SUGGESTIONS.map((s) => (
          <Link
            key={s.slug}
            href={`/showrunner/new-series/${s.slug}`}
            className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-400"
          >
            {s.pick ? <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">Showrunner&apos;s pick</p> : null}
            <p className="text-lg font-semibold text-slate-900">{s.title}</p>
            <p className="mt-1 text-sm text-slate-600">{s.pitch}</p>
            <p className="mt-2 text-sm text-slate-500">Finale: {s.finale}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
