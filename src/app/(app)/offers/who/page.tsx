import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireQuoteStaff } from "@/lib/quotes/access";
import { contactSearchWhere } from "@/lib/contacts/query";
import { isOfferKindKey, OFFER_KINDS, parseContactIds } from "@/lib/quotes/kinds";
import { ensureDefaultContactTags } from "@/lib/contacts/seed";
import { OfferAudiencePicker } from "./OfferAudiencePicker";

type SearchParams = Promise<{ kind?: string; contact?: string; contacts?: string; q?: string }>;

export default async function OfferWhoPage({ searchParams }: { searchParams: SearchParams }) {
  const { brand } = await requireQuoteStaff();
  await ensureDefaultContactTags(brand.id);
  const params = await searchParams;
  const kind = typeof params.kind === "string" ? params.kind : "";
  if (!isOfferKindKey(kind)) redirect("/offers");

  const kindMeta = OFFER_KINDS.find((item) => item.key === kind)!;
  const selectedIds = parseContactIds(params.contacts ?? params.contact);
  const q = typeof params.q === "string" ? params.q.trim() : "";

  const [initialContacts, initialSelected, tags] = await Promise.all([
    prisma.contact.findMany({
      where: contactSearchWhere({
        brandId: brand.id,
        q,
        status: "active",
        tagIds: [],
      }),
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: 80,
      select: {
        id: true,
        name: true,
        email: true,
        company: true,
        roleTitle: true,
        phoneE164: true,
      },
    }),
    selectedIds.length
      ? prisma.contact.findMany({
          where: { brandId: brand.id, id: { in: selectedIds } },
          orderBy: [{ name: "asc" }],
          select: {
            id: true,
            name: true,
            email: true,
            company: true,
            roleTitle: true,
            phoneE164: true,
          },
        })
      : Promise.resolve([]),
    prisma.contactTag.findMany({
      where: { brandId: brand.id, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { id: true, label: true },
    }),
  ]);

  return (
    <div className="p-8">
      <Link href="/offers" className="text-xs text-slate-400 hover:underline">
        ← All offers
      </Link>
      <h1 className="mt-1 text-2xl font-semibold text-slate-900">{kindMeta.name}</h1>
      <p className="mt-1 text-sm text-slate-500">First, choose who this offer is for.</p>
      <OfferAudiencePicker
        kind={kind}
        kindLabel={kindMeta.name}
        initialContacts={initialContacts}
        initialSelected={initialSelected}
        tags={tags}
      />
    </div>
  );
}
