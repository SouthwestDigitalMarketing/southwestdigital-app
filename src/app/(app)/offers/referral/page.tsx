import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireQuoteStaff } from "@/lib/quotes/access";
import { formatPhone } from "@/lib/phone";
import { parseContactIds } from "@/lib/quotes/kinds";

type SearchParams = Promise<{ contact?: string; contacts?: string; offer?: string }>;

export default async function ReferralOfferPage({ searchParams }: { searchParams: SearchParams }) {
  const { brand } = await requireQuoteStaff();
  const params = await searchParams;
  const offerId = typeof params.offer === "string" ? params.offer.trim() : "";
  const saved = offerId
    ? await prisma.quote.findFirst({
        where: { id: offerId, brandId: brand.id },
        select: { snapshotJson: true },
      })
    : null;
  const snapshot =
    saved?.snapshotJson && typeof saved.snapshotJson === "object"
      ? (saved.snapshotJson as { contactIds?: string[] })
      : {};
  const contactIds = parseContactIds(params.contacts ?? params.contact ?? snapshot.contactIds);

  const contacts = contactIds.length
    ? await prisma.contact.findMany({
        where: { id: { in: contactIds }, brandId: brand.id },
        select: {
          id: true,
          name: true,
          email: true,
          company: true,
          roleTitle: true,
          phoneE164: true,
        },
      })
    : [];

  const ordered = contactIds
    .map((id) => contacts.find((contact) => contact.id === id))
    .filter((contact): contact is NonNullable<typeof contact> => Boolean(contact));

  return (
    <div className="p-8">
      <Link href="/offers" className="text-xs text-slate-400 hover:underline">
        ← All offers
      </Link>
      <h1 className="mt-1 text-2xl font-semibold text-slate-900">Referral network</h1>
      <p className="mt-1 text-sm text-slate-500">
        Partner offer for bookkeepers and other referrals. Details you confirm here should stay in
        sync with the contact records.
      </p>

      <div className="mt-6 max-w-2xl space-y-4">
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-800">Who it&apos;s for</h2>
            <Link
              href={`/offers/who?kind=referral-network${contactIds.length ? `&contacts=${contactIds.join(",")}` : ""}`}
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Change
            </Link>
          </div>
          {ordered.length > 0 ? (
            <ul className="mt-3 space-y-3">
              {ordered.map((contact) => (
                <li key={contact.id} className="text-sm text-slate-700">
                  <p className="font-medium text-slate-900">{contact.name}</p>
                  <p className="mt-0.5 text-slate-500">
                    {[
                      contact.roleTitle,
                      contact.company,
                      contact.email,
                      contact.phoneE164 ? formatPhone(contact.phoneE164) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              No contacts selected.{" "}
              <Link href="/offers/who?kind=referral-network" className="font-medium text-slate-800 hover:underline">
                Choose who this is for
              </Link>
              .
            </p>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-semibold text-slate-800">This offer</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>Introduce the partner to the {brand.name} referral network</li>
            <li>Spell out how referrals are sent and received</li>
            <li>Leave room for commercial terms once those are confirmed</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
