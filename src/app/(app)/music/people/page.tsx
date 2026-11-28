import Link from "next/link";
import { requireStaffBrand } from "@/lib/brands/staff";
import { GROUP_TAG_KEYS, GROUP_TAGS, websiteFromNotes } from "@/lib/music/people";
import { SET_LIST_CONTACTS } from "@/lib/music/setListContacts";
import { formatPhone } from "@/lib/phone";
import { withBrandDataTransaction } from "@/lib/tenancy/context";
import { AddPeopleButton } from "./AddPeopleButton";

export const dynamic = "force-dynamic";

const QUESTIONS = [
  "Which songs fill the dance floor every time?",
  "What do couples pick for the first dance and the parent dances right now?",
  "What gets requested most, and what is on most do-not-play lists?",
  "What does a band do that makes your job easy, or hard?",
];

/** People (Tom, 2026-11-28): contact cards tagged for the wedding band, to ask what songs to play. */
export default async function MusicPeoplePage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const { group } = await searchParams;
  const { dataContext } = await requireStaffBrand();
  const active = group && GROUP_TAG_KEYS.includes(group) ? group : null;
  const contacts = await withBrandDataTransaction(dataContext, (tx) =>
    tx.contact.findMany({
      where: { brandId: dataContext.brandId, isActive: true, tagLinks: { some: { tag: { key: { in: active ? [active] : GROUP_TAG_KEYS } } } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, phoneE164: true, notes: true, tagLinks: { select: { tag: { select: { key: true, label: true } } } } },
    }),
  );
  const groups = Object.values(GROUP_TAGS);
  const filterClass = (on: boolean) =>
    `rounded-full border px-3 py-1 text-sm ${on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700 hover:border-slate-500"}`;

  return (
    <div className="p-4 sm:p-8">
      <h1 className="text-2xl font-semibold text-slate-900">People</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">
        People who go to a lot of weddings. Ask them what to play, then add their picks on the Set list tab. Calls, texts and notes live on each contact card.
      </p>

      {!active && contacts.length < SET_LIST_CONTACTS.length ? <AddPeopleButton count={SET_LIST_CONTACTS.length} /> : null}

      <h2 className="mt-6 text-lg font-semibold text-slate-900">What to ask</h2>
      <ul className="mt-2 max-w-2xl list-disc space-y-1 pl-5 text-sm text-slate-700">
        {QUESTIONS.map((q) => (
          <li key={q}>{q}</li>
        ))}
      </ul>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/music/people" className={filterClass(!active)}>All</Link>
        {groups.map((tag) => (
          <Link key={tag.key} href={`/music/people?group=${tag.key}`} className={filterClass(active === tag.key)}>
            {tag.label}
          </Link>
        ))}
      </div>

      {contacts.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">No contacts here yet.</p>
      ) : (
        <div className="mt-4 max-w-4xl overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 pr-4 font-medium">Phone</th>
                <th className="py-2 font-medium">Website</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {contacts.map((c) => {
                const type = c.tagLinks.map((l) => l.tag).find((t) => GROUP_TAG_KEYS.includes(t.key));
                const site = websiteFromNotes(c.notes);
                return (
                  <tr key={c.id}>
                    <td className="py-2 pr-4">
                      <Link href={`/contacts/${c.id}`} className="text-slate-900 underline-offset-2 hover:underline">{c.name}</Link>
                    </td>
                    <td className="py-2 pr-4 text-slate-600">{type?.label ?? ""}</td>
                    <td className="whitespace-nowrap py-2 pr-4">
                      {c.phoneE164 ? (
                        <a href={`tel:${c.phoneE164}`} className="text-slate-700 underline-offset-2 hover:underline">{formatPhone(c.phoneE164)}</a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2">
                      {site ? (
                        <a href={site} target="_blank" rel="noopener noreferrer" className="text-slate-700 underline-offset-2 hover:underline">
                          {site.replace(/^https?:\/\/(www\.)?/, "")}
                        </a>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
