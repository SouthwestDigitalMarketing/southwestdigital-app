import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireStaffBrand } from "@/lib/brands/staff";
import { sendPageLink } from "@/lib/phone-intake/ticket";
import { PRIVACY_COOKIE, privacyOn } from "@/lib/privacy";

export const dynamic = "force-dynamic";

/**
 * Published client reports live on ripley and never leave it. This page only
 * signs a link to ripley's tailnet Reports page and goes straight there.
 */
function freshReportsLink() {
  return sendPageLink({
    secret: process.env.PHONE_INTAKE_SECRET ?? "",
    publicUrl: process.env.PHONE_INTAKE_PUBLIC_URL ?? "",
    nowSeconds: Math.floor(Date.now() / 1000),
    path: "/reports",
  });
}

export default async function ReportsPage() {
  await requireStaffBrand();
  const link = freshReportsLink();
  if (link.ok) {
    // ripley keeps its own copy of the privacy cookie; this sets it to match the app's switch.
    const url = new URL(link.url);
    url.searchParams.set("privacy", privacyOn((await cookies()).get(PRIVACY_COOKIE)?.value) ? "1" : "0");
    redirect(url.toString());
  }

  return (
    <div className="p-4 sm:p-8">
      <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
      <p className="mt-2 text-base text-rose-700">{link.error}</p>
    </div>
  );
}
