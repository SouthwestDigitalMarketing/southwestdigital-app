import { youtubeSampleMode } from "@/lib/youtube/devSample";

/** Says plainly when the YouTube and click numbers on a page are the dev server's made-up ones. */
export function SampleNumbersBanner() {
  if (!youtubeSampleMode()) return null;
  return (
    <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
      Sample numbers: this dev server makes up its YouTube views and link clicks.
    </p>
  );
}
