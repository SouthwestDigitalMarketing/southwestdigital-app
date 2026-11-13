import Link from "next/link";

export function NewVideoEntry() {
  return (
    <div className="mb-6 flex justify-end">
      <Link
        href="/youtube/new"
        className="inline-flex rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700"
      >
        Create new video
      </Link>
    </div>
  );
}
