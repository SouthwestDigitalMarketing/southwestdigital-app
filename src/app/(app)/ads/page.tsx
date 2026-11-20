import { requireStaffBrand } from "@/lib/brands/staff";
import { CreateAdButton } from "./CreateAdButton";

export const dynamic = "force-dynamic";

export default async function AdsPage() {
  await requireStaffBrand();

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-8">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Ads</h1>
        <div className="self-start sm:self-auto">
          <CreateAdButton />
        </div>
      </div>
    </div>
  );
}
