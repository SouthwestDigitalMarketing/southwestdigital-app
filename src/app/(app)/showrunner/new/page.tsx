import { requireAppBrand } from "@/lib/brands/staff";
import { SourcePicker } from "./source-picker";

export default async function NewVideoPage() {
  const { brand } = await requireAppBrand();

  return (
    <div className="p-4 sm:p-8">
      <h1 className="text-2xl font-semibold text-slate-900">New video</h1>
      <p className="mt-2 text-slate-600">First, where are the video files for {brand.name} right now?</p>
      <SourcePicker />
    </div>
  );
}
