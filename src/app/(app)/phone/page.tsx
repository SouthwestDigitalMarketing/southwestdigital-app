import { requireStaffBrand } from "@/lib/brands/staff";
import PhoneSend from "./PhoneSend";

export const dynamic = "force-dynamic";

export default async function PhonePage() {
  await requireStaffBrand();
  const ready = Boolean(process.env.PHONE_INTAKE_SECRET && process.env.PHONE_INTAKE_PUBLIC_URL);

  return (
    <div className="p-4 sm:p-8">
      <h1 className="text-2xl font-semibold text-slate-900">Send from your phone</h1>
      <p className="mt-2 max-w-xl text-base text-slate-600">
        Pick videos and pictures. They land on ripley. Each file shows its size and a check code.
      </p>
      {ready ? (
        <PhoneSend />
      ) : (
        <p className="mt-6 text-base text-rose-700">The send road is not set up on this server yet.</p>
      )}
    </div>
  );
}
