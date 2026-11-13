import Link from "next/link";

export function NewVideoEntry() {
  return (
    <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">Make a new video</h2>
      <p className="mt-2 text-sm text-slate-600">
        Start with the footage. We will find where it is, bring it into a project on ripley, then open the right Showrunner mode.
      </p>
      <Link
        href="/youtube/new"
        className="mt-5 inline-flex rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700"
      >
        Start a video
      </Link>
    </div>
  );
}
