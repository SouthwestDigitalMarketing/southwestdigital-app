import { redirect } from "next/navigation";
import { requireStaffBrand } from "@/lib/brands/staff";
import { sendPageLink } from "@/lib/phone-intake/ticket";

export const dynamic = "force-dynamic";

/**
 * Agreement PDFs live in each client's folder on ripley and never leave it. This
 * page checks the staff login, then signs a link to ripley's tailnet Agreements
 * page (every client with PDFs; same road as Reports) and goes straight there.
 */
export default async function AgreementPdfsPage() {
  await requireStaffBrand();
  const link = sendPageLink({
    secret: process.env.PHONE_INTAKE_SECRET ?? "",
    publicUrl: process.env.PHONE_INTAKE_PUBLIC_URL ?? "",
    nowSeconds: Math.floor(Date.now() / 1000),
    path: "/agreements",
  });
  if (link.ok) redirect(link.url);

  return (
    <div className="p-4 sm:p-8">
      <h1 className="text-2xl font-semibold text-slate-900">Agreement PDFs</h1>
      <p className="mt-2 text-base text-rose-700">{link.error}</p>
    </div>
  );
}
