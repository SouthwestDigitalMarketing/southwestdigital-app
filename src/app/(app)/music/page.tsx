import { ExternalLink } from "lucide-react";
import { requireStaffBrand } from "@/lib/brands/staff";
import { MUSIC_MAIN, MUSIC_SITES } from "@/lib/sites";

/** Music (Tom, 2026-11-28): from the menu, one more tap opens the wedding band site. */
export default async function MusicPage() {
  await requireStaffBrand();

  return (
    <div className="p-4 sm:p-8">
      <h1 className="text-2xl font-semibold text-slate-900">Music</h1>

      <a
        href={MUSIC_MAIN.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 flex max-w-xl items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-400"
      >
        <span>
          <span className="block font-semibold text-slate-900">{MUSIC_MAIN.name}</span>
          <span className="block text-sm text-slate-600">{MUSIC_MAIN.host}</span>
        </span>
        <ExternalLink size={20} className="shrink-0 text-slate-500" aria-label="Opens in a new tab" />
      </a>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">Sites</h2>
      <div className="mt-3 max-w-3xl overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="py-2 pr-4 font-medium">Site</th>
              <th className="py-2 pr-4 font-medium">Use</th>
              <th className="py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {MUSIC_SITES.map((site) => (
              <tr key={site.host}>
                <td className="py-2 pr-4">
                  <a href={site.url} target="_blank" rel="noopener noreferrer" className="text-slate-900 underline-offset-2 hover:underline">
                    {site.host}
                  </a>
                </td>
                <td className="py-2 pr-4 text-slate-600">{site.use}</td>
                <td className="py-2 text-slate-600">{site.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
