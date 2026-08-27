import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaffBrand } from "@/lib/brands/staff";
import { formatPhone } from "@/lib/phone";
import { ensureDefaultContactTags } from "@/lib/contacts/seed";
import { contactOrderBy, contactSearchWhere } from "@/lib/contacts/query";
import {
  PAGE_SIZE,
  parseContactSort,
  parsePage,
  parseStatusFilter,
  parseTagKeys,
} from "@/lib/contacts/tags";
import { BrandStatus } from "@prisma/client";
import { ContactsFilters } from "./ContactsFilters";
import { CreateContactDialog } from "./CreateContactDialog";
import { ContactActions } from "./ContactActions";
import { CopyEmail } from "./CopyEmail";


type SearchParams = Promise<{
  q?: string;
  status?: string;
  sort?: string;
  tag?: string | string[];
  page?: string;
  client?: string;
  brand?: string;
}>;

function hrefFor(args: {
  q: string;
  status: string;
  sort: string;
  tagKeys: string[];
  clientId: string;
  relatedBrandId: string;
  page?: number;
}) {
  const params = new URLSearchParams();
  if (args.q) params.set("q", args.q);
  if (args.status !== "all") params.set("status", args.status);
  if (args.sort !== "name") params.set("sort", args.sort);
  if (args.clientId) params.set("client", args.clientId);
  if (args.relatedBrandId) params.set("brand", args.relatedBrandId);
  for (const key of args.tagKeys) params.append("tag", key);
  if (args.page && args.page > 1) params.set("page", String(args.page));
  const qs = params.toString();
  return qs ? `/contacts?${qs}` : "/contacts";
}

export default async function ContactsPage({ searchParams }: { searchParams: SearchParams }) {
  const { brand, isPlatformOperator } = await requireStaffBrand();
  await ensureDefaultContactTags(brand.id);

  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const status = parseStatusFilter(params.status ?? "active");
  const sort = parseContactSort(params.sort);
  const tagKeys = parseTagKeys(params.tag);
  const page = parsePage(params.page);
  const clientId = typeof params.client === "string" ? params.client.trim() : "";
  const relatedBrandId = typeof params.brand === "string" ? params.brand.trim() : "";

  const tags = await prisma.contactTag.findMany({
    where: { brandId: brand.id, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    select: {
      id: true,
      key: true,
      label: true,
      kind: true,
      _count: { select: { contacts: true } },
    },
  });

  const selectedTagIds = tags.filter((tag) => tagKeys.includes(tag.key)).map((tag) => tag.id);
  const where = contactSearchWhere({
    brandId: brand.id,
    q,
    status,
    tagIds: selectedTagIds,
    clientId: clientId || undefined,
    relatedBrandId: relatedBrandId || undefined,
  });

  const [total, contacts, clients, platformBrands] = await Promise.all([
    prisma.contact.count({ where }),
    prisma.contact.findMany({
      where,
      orderBy: contactOrderBy(sort),
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        phoneE164: true,
        company: true,
        roleTitle: true,
        isActive: true,
        updatedAt: true,
        tagLinks: {
          select: {
            tag: { select: { id: true, key: true, label: true } },
          },
        },
      },
    }),
    prisma.ticketClient.findMany({
      where: { brandId: brand.id, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
    isPlatformOperator
      ? prisma.brand.findMany({
          where: { status: BrandStatus.ACTIVE },
          orderBy: { name: "asc" },
          select: { id: true, name: true, slug: true },
        })
      : Promise.resolve([]),
  ]);

  const clientOptions = clients.map((client) => ({
    id: client.id,
    label: client.name?.trim() || client.code,
  }));
  const brandOptions = platformBrands.map((item) => ({ id: item.id, label: item.name }));

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);

  return (
    <div className="p-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Contacts</h1>
        <p className="mt-1 text-sm text-slate-500">
          People this brand knows — leads, clients, bookkeepers, and industry contacts. Tag them
          to filter and, later, to place them on a pipeline.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        {[
          { label: "Showing", value: total },
          { label: "Tags", value: tags.length },
          { label: "Page", value: `${safePage} / ${pageCount}` },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-3xl font-semibold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <ContactsFilters
        q={q}
        status={status}
        sort={sort}
        selectedTagKeys={tagKeys}
        tags={tags.map((tag) => ({
          id: tag.id,
          key: tag.key,
          label: tag.label,
          kind: tag.kind,
          count: tag._count.contacts,
        }))}
        clients={clientOptions}
        clientId={clientId}
        brands={brandOptions}
        relatedBrandId={relatedBrandId}
      />

      <div className="mt-6 flex items-center gap-2">
        <CreateContactDialog
          tags={tags.map((tag) => ({ id: tag.id, label: tag.label, kind: tag.kind }))}
          clients={clientOptions}
          brands={brandOptions}
        />
        <Link
          href="/settings/tags"
          className="flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50"
        >
          Tags
        </Link>
      </div>

      <div className="mt-3 rounded-xl border border-slate-200 bg-white">
        {contacts.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-400">
            No contacts match these filters.
          </div>
        ) : (
          <table className="w-full table-fixed text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="w-[20%] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Name
                </th>
                <th className="w-[16%] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Role
                </th>
                <th className="w-[22%] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Email
                </th>
                <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Tags
                </th>
                <th className="w-[22rem] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <div
                      className={`truncate whitespace-nowrap font-medium ${
                        contact.isActive ? "text-slate-900" : "text-slate-400"
                      }`}
                      title={contact.name}
                    >
                      {contact.name}
                    </div>
                  </td>
                  <td
                    className="truncate whitespace-nowrap px-4 py-2 text-slate-600"
                    title={contact.roleTitle || undefined}
                  >
                    {contact.roleTitle || "—"}
                  </td>
                  <td className="px-4 py-2">
                    <CopyEmail
                      email={contact.email}
                      fallback={contact.phoneE164 ? formatPhone(contact.phoneE164) : "—"}
                    />
                  </td>
                  <td className="overflow-hidden whitespace-nowrap px-4 py-2">
                    {contact.tagLinks.length === 0 ? (
                      <span className="text-xs text-slate-400">—</span>
                    ) : (
                      contact.tagLinks.map((link) => (
                        <span
                          key={link.tag.id}
                          className="mr-1 inline-flex max-w-[10rem] truncate rounded-full bg-slate-100 px-2 py-0.5 align-middle text-[11px] font-medium text-slate-700"
                        >
                          {link.tag.label}
                        </span>
                      ))
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <ContactActions contactId={contact.id} isActive={contact.isActive} compact />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          {safePage > 1 ? (
            <Link
              href={hrefFor({
                q,
                status,
                sort,
                tagKeys,
                clientId,
                relatedBrandId,
                page: safePage - 1,
              })}
              className="font-medium text-slate-900 hover:underline"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          {safePage < pageCount ? (
            <Link
              href={hrefFor({
                q,
                status,
                sort,
                tagKeys,
                clientId,
                relatedBrandId,
                page: safePage + 1,
              })}
              className="font-medium text-slate-900 hover:underline"
            >
              Next →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
