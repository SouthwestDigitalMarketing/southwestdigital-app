import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaffBrand } from "@/lib/brands/staff";
import { sendPageLink } from "@/lib/phone-intake/ticket";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

function folderSlug(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function clientAgreementsLink(slug: string, code: string) {
  return sendPageLink({
    secret: process.env.PHONE_INTAKE_SECRET ?? "",
    publicUrl: process.env.PHONE_INTAKE_PUBLIC_URL ?? "",
    nowSeconds: Math.floor(Date.now() / 1000),
    path: `/agreements/${slug}`,
    extra: { alt: folderSlug(code) },
  });
}

/**
 * Agreement PDFs live in the client's folder on ripley and never leave it. This
 * page checks the staff login, then signs a link to ripley's tailnet Agreements
 * page for this client (same road as Reports) and goes straight there.
 */
export default async function ClientAgreementsPage({ params }: PageProps) {
  const { brand } = await requireStaffBrand();
  const { id } = await params;
  const client = await prisma.ticketClient.findFirst({
    where: { id, brandId: brand.id },
    select: { name: true, code: true },
  });
  if (!client) notFound();

  const slug = folderSlug(client.name || client.code) || folderSlug(client.code);
  const link = clientAgreementsLink(slug, client.code);
  if (link.ok) redirect(link.url);

  return (
    <div className="p-4 sm:p-8">
      <h1 className="text-2xl font-semibold text-slate-900">Agreements</h1>
      <p className="mt-2 text-base text-rose-700">{link.error}</p>
    </div>
  );
}
