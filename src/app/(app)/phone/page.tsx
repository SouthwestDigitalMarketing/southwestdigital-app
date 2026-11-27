import { redirect } from "next/navigation";
import { requireStaffBrand } from "@/lib/brands/staff";
import { sendPageLink } from "@/lib/phone-intake/ticket";

export const dynamic = "force-dynamic";

function freshSendLink(addTo?: string) {
  return sendPageLink({
    secret: process.env.PHONE_INTAKE_SECRET ?? "",
    publicUrl: process.env.PHONE_INTAKE_PUBLIC_URL ?? "",
    nowSeconds: Math.floor(Date.now() / 1000),
    extra: addTo ? { addTo } : undefined,
  });
}

export default async function PhonePage({ searchParams }: { searchParams: Promise<{ addTo?: string }> }) {
  await requireStaffBrand();
  const addTo = (await searchParams).addTo?.trim() ?? "";
  const link = freshSendLink(/^[A-Za-z0-9-]{1,60}$/.test(addTo) ? addTo : undefined);
  // Straight to ripley's send page: the picker's "My phone" lands here, so no second button.
  if (link.ok) redirect(link.url);

  return (
    <div className="p-4 sm:p-8">
      <h1 className="text-2xl font-semibold text-slate-900">Send from your phone</h1>
      <p className="mt-2 text-base text-rose-700">{link.ok ? "" : link.error}</p>
    </div>
  );
}
