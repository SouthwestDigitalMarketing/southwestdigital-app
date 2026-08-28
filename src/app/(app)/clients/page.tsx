import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaffBrand } from "@/lib/brands/staff";
import { parsePage, parseStatusFilter } from "@/lib/contacts/tags";
import { CreateClientDialog } from "./CreateClientDialog";

type SearchParams = Promise<{ q?: string; status?: string; page?: string }>;

const PAGE_SIZE = 50;

export default async function ClientsPage({ searchParams }: { searchParams: SearchParams }) {
  const { brand } = await requireStaffBrand();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const status = parseStatusFilter(params.status);
  const page = parsePage(params.page);

  const where = {
    brandId: brand.id,
    ...(status === "active" ? { isActive: true } : {}),
    ...(status === "inactive" ? { isActive: false } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { code: { contains: q, mode: "insensitive" as const } },
            { businessLegalName: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, clients] = await Promise.all([
    prisma.ticketClient.count({ where }),
    prisma.ticketClient.findMany({
      where,
      orderBy: [{ name: "asc" }, { code: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
        updatedAt: true,
        _count: { select: { contacts: true, tickets: true } },
      },
    }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-8">
      <h1 className="sr-only">Clients</h1>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Client directory</h2>
        <CreateClientDialog />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Clients</p>
          <p className="mt-1 text-3xl font-semibold text-slate-900">{total}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contacts</p>
          <p className="mt-1 text-sm text-slate-500">
            People are managed separately so you can keep thousands of contacts without turning them
            all into clients.
          </p>
        </div>
      </div>

      <form className="mt-6 rounded-xl border border-slate-200 bg-white p-4" method="get">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Filters</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name or code"
            className="min-w-[16rem] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            name="status"
            defaultValue={status}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button
            type="submit"
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50"
          >
            Search
          </button>
        </div>
      </form>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Client list</p>
        </div>
        {clients.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-400">No clients yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="px-5 py-3 text-sm font-semibold normal-case text-slate-700">
                  Client
                </th>
                <th className="px-5 py-3 text-sm font-semibold normal-case text-slate-700">
                  Code
                </th>
                <th className="px-5 py-3 text-sm font-semibold normal-case text-slate-700">
                  People
                </th>
                <th className="px-5 py-3 text-sm font-semibold normal-case text-slate-700">
                  Status
                </th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900">{client.name || "—"}</td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-500">{client.code}</td>
                  <td className="px-5 py-3 text-slate-600">{client._count.contacts}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        client.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {client.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/clients/${client.id}`}
                      className="text-xs font-medium text-slate-900 hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pageCount > 1 && (
        <div className="mt-4 flex justify-between text-sm">
          {page > 1 ? (
            <Link
              href={`/clients?q=${encodeURIComponent(q)}&status=${status}&page=${page - 1}`}
              className="font-medium text-slate-900 hover:underline"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          {page < pageCount ? (
            <Link
              href={`/clients?q=${encodeURIComponent(q)}&status=${status}&page=${page + 1}`}
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
