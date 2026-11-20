import { requireStaffBrand } from "@/lib/brands/staff";
import { CreateAdForm } from "./CreateAdForm";

export const dynamic = "force-dynamic";

export default async function CreateAdPage() {
  await requireStaffBrand();

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-8">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h1 className="text-xl font-semibold text-slate-900">Create ad</h1>
        <p className="mt-1 text-sm text-slate-500">Draft a Facebook and Instagram ad. It stays a draft until you approve it.</p>
      </div>
      <CreateAdForm />
    </div>
  );
}
