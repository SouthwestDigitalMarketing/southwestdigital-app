import { requireStaffBrand } from "@/lib/brands/staff";
import { SET_LIST_CONTACTS, SET_LIST_GROUPS } from "@/lib/music/setListContacts";

const QUESTIONS = [
  "Which songs fill the dance floor every time?",
  "What do couples pick for the first dance and the parent dances right now?",
  "What gets requested most, and what is on most do-not-play lists?",
  "What does a band do that makes your job easy, or hard?",
];

/** Set list (Tom, 2026-11-28): people who see lots of weddings, to ask what songs to play. */
export default async function SetListPage() {
  await requireStaffBrand();

  return (
    <div className="p-4 sm:p-8">
      <h1 className="text-2xl font-semibold text-slate-900">Set list</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">
        People who go to a lot of weddings. Ask them what to play. Nobody on this list has been contacted yet.
      </p>

      <h2 className="mt-6 text-lg font-semibold text-slate-900">What to ask</h2>
      <ul className="mt-2 max-w-2xl list-disc space-y-1 pl-5 text-sm text-slate-700">
        {QUESTIONS.map((q) => (
          <li key={q}>{q}</li>
        ))}
      </ul>

      {SET_LIST_GROUPS.map((group) => {
        const rows = SET_LIST_CONTACTS.filter((c) => c.group === group);
        return (
          <section key={group} className="mt-8">
            <h2 className="text-lg font-semibold text-slate-900">
              {group} <span className="text-sm font-normal text-slate-500">({rows.length})</span>
            </h2>
            <div className="mt-3 max-w-4xl overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-slate-500">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Name</th>
                    <th className="py-2 pr-4 font-medium">Where</th>
                    <th className="py-2 pr-4 font-medium">Phone</th>
                    <th className="py-2 text-right font-medium">Reviews</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {rows.map((c) => (
                    <tr key={`${c.name}-${c.city}`}>
                      <td className="py-2 pr-4">
                        {c.url ? (
                          <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-slate-900 underline-offset-2 hover:underline">
                            {c.name}
                          </a>
                        ) : (
                          <span className="text-slate-900">{c.name}</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-slate-600">{c.city}</td>
                      <td className="whitespace-nowrap py-2 pr-4">
                        {c.phone ? (
                          <a href={`tel:+1${c.phone.replace(/\D/g, "")}`} className="text-slate-700 underline-offset-2 hover:underline">
                            {c.phone}
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2 text-right tabular-nums text-slate-600">{c.reviews}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <p className="mt-8 max-w-2xl text-xs text-slate-500">
        Source: Google Maps listings (via DataForSEO), 4.5 stars or better, most reviews first, pulled 2026-11-28.
      </p>
    </div>
  );
}
