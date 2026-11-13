import Link from "next/link";
import { requireAppBrand } from "@/lib/brands/staff";
import { SourcePicker } from "./source-picker";

export default async function NewVideoPage() {
  const { brand } = await requireAppBrand();

  return (
    <main className="p-8">
      <Link href="/youtube" className="text-sm text-slate-600 underline">Back to YouTube</Link>
      <h1 className="mt-6 text-3xl font-semibold text-slate-900">New video</h1>
      <p className="mt-2 text-slate-600">First, where are the video files for {brand.name} right now?</p>
      <SourcePicker />
    </main>
  );
}
