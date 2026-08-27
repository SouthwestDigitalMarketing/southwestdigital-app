import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaffBrand } from "@/lib/brands/staff";
import { ensureDefaultContactTags } from "@/lib/contacts/seed";
import { formatPhone } from "@/lib/phone";
import { ContactEditor } from "./ContactEditor";
import { ContactActions } from "../ContactActions";
import { BrandStatus } from "@prisma/client";
import { ContactTagsEditor } from "../ContactTagsEditor";
import { BrandAssignment, ClientAssignment } from "../AssignmentToggles";

type PageProps = { params: Promise<{ id: string }> };

export default async function ContactDetailPage({ params }: PageProps) {
  const { brand, isPlatformOperator } = await requireStaffBrand();
  await ensureDefaultContactTags(brand.id);
  const { id } = await params;

  const [rawContact, tags, clients, platformBrands] = await Promise.all([
    prisma.contact.findFirst({
      where: { id, brandId: brand.id },
      include: {
        tagLinks: { select: { tagId: true } },
        clientLinks: { select: { clientId: true } },
        brandLinks: { select: { relatedBrandId: true } },
        leadLinks: {
          select: {
            lead: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.contactTag.findMany({
      where: { brandId: brand.id, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { id: true, label: true, kind: true, _count: { select: { contacts: true } } },
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
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const contact = rawContact;

  if (!contact) notFound();

  const assigned = new Set(contact.tagLinks.map((link: { tagId: string }) => link.tagId));
  const pipelinePlacements: Array<{ pipeline: string; stage: string }> = [];

  return (
    <div className="space-y-8 p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/contacts" className="text-xs text-slate-400 hover:underline">
              ← All contacts
            </Link>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">{contact.name}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {contact.company || "No company"}
              {contact.email ? ` · ${contact.email}` : ""}
              {contact.phoneE164 ? ` · ${formatPhone(contact.phoneE164)}` : ""}
              {!contact.isActive ? " · Archived" : ""}
            </p>
          </div>
          <ContactActions contactId={contact.id} isActive={contact.isActive} />
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-semibold text-slate-800">Clients</h2>
          <p className="mt-1 text-xs text-slate-500">
            Companies this brand serves. Example: Dagny can be linked to Contigo Accounting as a
            client without turning every contact into a client.
          </p>
          <div className="mt-4">
            <ClientAssignment
              contactId={contact.id}
              clients={clients.map((client) => ({
                id: client.id,
                label: client.name?.trim() || client.code,
              }))}
              assignedIds={contact.clientLinks.map((link: { clientId: string }) => link.clientId)}
            />
          </div>
        </section>

        {isPlatformOperator && (
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-800">Brands</h2>
            <p className="mt-1 text-xs text-slate-500">
              App tenants this person is tied to. A person can belong to more than one brand.
            </p>
            <div className="mt-4">
              <BrandAssignment
                contactId={contact.id}
                brands={platformBrands.map((item) => ({ id: item.id, label: item.name }))}
                assignedIds={contact.brandLinks.map((link: { relatedBrandId: string }) => link.relatedBrandId)}
              />
            </div>
          </section>
        )}

        <ContactTagsEditor
          contactId={contact.id}
          tags={tags.map((tag) => ({
            id: tag.id,
            label: tag.label,
            kind: tag.kind,
            assigned: assigned.has(tag.id),
            usageCount: tag._count.contacts,
          }))}
        />

        {pipelinePlacements.length > 0 && (
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-800">Pipelines</h2>
            <ul className="mt-3 space-y-1 text-sm text-slate-700">
              {pipelinePlacements.map((item) => (
                <li key={`${item.pipeline}-${item.stage}`}>
                  {item.pipeline}
                  <span className="text-slate-400"> · {item.stage}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <ContactEditor
          contact={{
            id: contact.id,
            firstName: contact.firstName?.trim() || contact.name.split(" ")[0] || "",
            lastName:
              contact.lastName?.trim() || contact.name.split(" ").slice(1).join(" ").trim() || "",
            email: contact.email ?? "",
            phone: contact.phoneE164 ?? "",
            company: contact.company ?? "",
            roleTitle: contact.roleTitle ?? "",
            notes: contact.notes ?? "",
            isActive: contact.isActive,
          }}
        />
    </div>
  );
}
