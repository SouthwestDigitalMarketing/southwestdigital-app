import Link from "next/link";
import { requireAppBrand } from "@/lib/brands/staff";

export default async function ShowrunnerPage() {
  const { brand } = await requireAppBrand();

  return (
    <main className="p-8">
      <h1 className="text-3xl font-semibold text-slate-900">Showrunner</h1>
      <p className="mt-2 text-slate-600">Make the next video for {brand.name}.</p>
      <div className="mt-6">
        <Link
          href="/youtube/new"
          className="inline-flex rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700"
        >
          New video
        </Link>
      </div>
    </main>
  );
}
