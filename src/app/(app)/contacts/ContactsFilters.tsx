"use client";

import { useRouter } from "next/navigation";
import { TAG_KIND_LABELS, type ContactTagKindName } from "@/lib/contacts/tags";

type TagOption = {
  id: string;
  key: string;
  label: string;
  kind: ContactTagKindName;
  count: number;
};

export function ContactsFilters({
  q,
  status,
  sort,
  selectedTagKeys,
  tags,
  clients,
  clientId,
  brands,
  relatedBrandId,
}: {
  q: string;
  status: string;
  sort: string;
  selectedTagKeys: string[];
  tags: TagOption[];
  clients: Array<{ id: string; label: string }>;
  clientId: string;
  brands: Array<{ id: string; label: string }>;
  relatedBrandId: string;
}) {
  const router = useRouter();
  const selected = new Set(selectedTagKeys);

  function push(next: {
    q?: string;
    status?: string;
    sort?: string;
    tags?: string[];
    clientId?: string;
    relatedBrandId?: string;
  }) {
    const params = new URLSearchParams();
    const query = next.q ?? q;
    const nextStatus = next.status ?? status;
    const nextSort = next.sort ?? sort;
    const nextTags = next.tags ?? selectedTagKeys;
    const nextClientId = next.clientId ?? clientId;
    const nextBrandId = next.relatedBrandId ?? relatedBrandId;
    if (query) params.set("q", query);
    if (nextStatus && nextStatus !== "all") params.set("status", nextStatus);
    if (nextSort && nextSort !== "name") params.set("sort", nextSort);
    if (nextClientId) params.set("client", nextClientId);
    if (nextBrandId) params.set("brand", nextBrandId);
    for (const key of nextTags) params.append("tag", key);
    const qs = params.toString();
    router.push(qs ? `/contacts?${qs}` : "/contacts");
  }

  return (
    <div className="mt-6 space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <form
        className="flex flex-wrap gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          push({ q: String(data.get("q") ?? "").trim() });
        }}
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="Search name, email, company, role, or phone"
          className="min-w-[16rem] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        <select
          value={status}
          onChange={(event) => push({ status: event.target.value })}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select
          value={clientId}
          onChange={(event) => push({ clientId: event.target.value })}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">All clients</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.label}
            </option>
          ))}
        </select>
        {brands.length > 0 && (
          <select
            value={relatedBrandId}
            onChange={(event) => push({ relatedBrandId: event.target.value })}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">All brands</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.label}
              </option>
            ))}
          </select>
        )}
        <select
          value={sort}
          onChange={(event) => push({ sort: event.target.value })}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="name">Name A–Z</option>
          <option value="name-desc">Name Z–A</option>
          <option value="updated">Recently updated</option>
          <option value="created">Newest</option>
        </select>
        <button
          type="submit"
          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50"
        >
          Search
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => {
          const on = selected.has(tag.key);
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => {
                const next = on
                  ? selectedTagKeys.filter((key) => key !== tag.key)
                  : [...selectedTagKeys, tag.key];
                push({ tags: next });
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                on
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {tag.label}
              <span className={on ? "ml-1 text-white/70" : "ml-1 text-slate-400"}>
                {tag.count}
              </span>
              <span className="sr-only"> {TAG_KIND_LABELS[tag.kind]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
