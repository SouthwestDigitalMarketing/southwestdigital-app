import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaffBrand } from "@/lib/brands/staff";
import { ClientEditor } from "./ClientEditor";
import { LinkContactForm } from "./LinkContactForm";
import { unlinkContactFromClientAction } from "../actions";

type PageProps = { params: Promise<{ id: string }> };

export default async function ClientDetailPage({ params }: PageProps) {
  const { brand } = await requireStaffBrand();
  const { id } = await params;

  const [client, availableContacts] = await Promise.all([
    prisma.ticketClient.findFirst({
      where: { id, brandId: brand.id },
      include: {
        contacts: {
          orderBy: { createdAt: "desc" },
          select: {
            contact: {
              select: { id: true, name: true, email: true, roleTitle: true, company: true },
            },
          },
        },
      },
    }),
    prisma.contact.findMany({
      where: {
        brandId: brand.id,
        isActive: true,
        clientLinks: { none: { clientId: id } },
      },
      orderBy: { name: "asc" },
      take: 200,
      select: { id: true, name: true, email: true, company: true },
    }),
  ]);

  if (!client) notFound();

  return (
    <div className="p-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <Link href="/clients" className="text-xs text-slate-400 hover:underline">
            ← All clients
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            {client.name || client.code}
          </h1>
          <p className="mt-1 font-mono text-xs text-slate-400">{client.code}</p>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-semibold text-slate-800">People</h2>
          <p className="mt-1 text-xs text-slate-500">
            Link existing contacts to this client. Creating a person still happens on Contacts.
          </p>

          {client.contacts.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">No people linked yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {client.contacts.map(({ contact }) => (
                <li key={contact.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <Link
                      href={`/contacts/${contact.id}`}
                      className="text-sm font-medium text-slate-900 hover:underline"
                    >
                      {contact.name}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {contact.email || "No email"}
                      {contact.roleTitle ? ` · ${contact.roleTitle}` : ""}
                    </p>
                  </div>
                  <form action={unlinkContactFromClientAction}>
                    <input type="hidden" name="clientId" value={client.id} />
                    <input type="hidden" name="contactId" value={contact.id} />
                    <button
                      type="submit"
                      className="text-xs font-medium text-slate-500 hover:text-slate-900"
                    >
                      Unlink
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          <LinkContactForm clientId={client.id} contacts={availableContacts} />
        </section>

        <ClientEditor
          client={{
            id: client.id,
            name: client.name ?? "",
            code: client.code,
            businessLegalName: client.businessLegalName ?? "",
            entityType: client.entityType ?? "",
            email: client.authorizedCommunicationEmail ?? "",
            phone: client.primaryContactPhone ?? "",
            isActive: client.isActive,
          }}
        />
      </div>
    </div>
  );
}
