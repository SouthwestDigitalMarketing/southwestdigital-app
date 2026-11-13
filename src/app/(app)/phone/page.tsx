import { requireStaffBrand } from "@/lib/brands/staff";
import { sendPageLink } from "@/lib/phone-intake/ticket";

export const dynamic = "force-dynamic";

function freshSendLink() {
  return sendPageLink({
    secret: process.env.PHONE_INTAKE_SECRET ?? "",
    publicUrl: process.env.PHONE_INTAKE_PUBLIC_URL ?? "",
    nowSeconds: Math.floor(Date.now() / 1000),
  });
}

export default async function PhonePage() {
  await requireStaffBrand();
  const link = freshSendLink();

  return (
    <div className="p-4 sm:p-8">
      <h1 className="text-2xl font-semibold text-slate-900">Send from your phone</h1>
      <p className="mt-2 max-w-xl text-base text-slate-600">
        Tap the button, then pick videos and pictures. They land on ripley. Each file shows its size and a check code.
        Tailscale must be on.
      </p>
      {link.ok ? (
        <a
          className="mt-6 inline-flex rounded-full bg-slate-900 px-6 py-4 text-base font-semibold text-white"
          href={link.url}
        >
          Open the send page
        </a>
      ) : (
        <p className="mt-6 text-base text-rose-700">{link.error}</p>
      )}
    </div>
  );
}
