"use client";

import { SearchInput } from "@/components/keyboard/SearchInput";
import { useRouter } from "next/navigation";
import { RELATIONSHIP_TAGS, type ContactRelationship } from "@/lib/contacts/tags";

export function ContactsFilters({
  q,
  status,
  sort,
  selectedTagKeys,
  relationship,
  brands,
  relatedBrandId,
}: {
  q: string;
  status: string;
  sort: string;
  selectedTagKeys: string[];
  relationship: ContactRelationship;
  brands: Array<{ id: string; label: string }>;
  relatedBrandId: string;
}) {
  const router = useRouter();

  function push(next: {
    q?: string;
    status?: string;
    sort?: string;
    relationship?: ContactRelationship;
    relatedBrandId?: string;
  }) {
    const params = new URLSearchParams();
    const query = next.q ?? q;
    const nextStatus = next.status ?? status;
    const nextSort = next.sort ?? sort;
    const nextRelationship = next.relationship ?? relationship;
    const nextBrandId = next.relatedBrandId ?? relatedBrandId;
    if (query) params.set("q", query);
    if (nextStatus && nextStatus !== "all") params.set("status", nextStatus);
    if (nextSort && nextSort !== "name") params.set("sort", nextSort);
    if (nextRelationship !== "all") params.set("rel", nextRelationship);
    if (nextBrandId) params.set("brand", nextBrandId);
    for (const key of selectedTagKeys) params.append("tag", key);
    const qs = params.toString();
    router.push(qs ? `/contacts?${qs}` : "/contacts", { scroll: false });
  }

  return (
    <form
      aria-label="Filters"
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        push({ q: String(data.get("q") ?? "").trim() });
      }}
    >
      <SearchInput
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
        value={relationship}
        onChange={(event) => push({ relationship: event.target.value as ContactRelationship })}
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        aria-label="Relationship"
      >
        <option value="all">All people</option>
        {RELATIONSHIP_TAGS.map((tag) => (
          <option key={tag.key} value={tag.key}>
            {tag.label}
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
  );
}
