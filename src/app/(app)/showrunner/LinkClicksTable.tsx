import type { SourceTagClickReport } from "@/lib/cloudflare/clickSnapshots";
import type { SourceTagVideo } from "@/lib/youtube/sourceTagVideos";

/** Clicks on each video's short link (Cloudflare). The link column hides on phones so the counts fit. */
export function LinkClicksTable({
  report,
  sourceTagMap,
  redirectDomain,
}: {
  report: SourceTagClickReport;
  sourceTagMap: Map<string, SourceTagVideo>;
  redirectDomain: string;
}) {
  if (report.byTag.length === 0) {
    return <p className="mt-3 text-sm text-slate-400">No link clicks recorded yet.</p>;
  }
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead>
          <tr>
            <th className="px-3 py-2 text-sm font-semibold normal-case text-slate-700">Video</th>
            <th className="hidden whitespace-nowrap px-3 py-2 text-sm font-semibold normal-case text-slate-700 sm:table-cell">Link</th>
            <th className="whitespace-nowrap px-3 py-2 text-sm font-semibold normal-case text-slate-700">Clicks</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {report.byTag.map(({ tag, clicks }: { tag: string; clicks: number }) => {
            const video = sourceTagMap.get(tag);
            return (
              <tr key={tag}>
                <td className="px-3 py-2">
                  {video ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        width={96}
                        height={54}
                        className="shrink-0 rounded object-cover"
                      />
                      <span className="text-slate-700">{video.title}</span>
                    </div>
                  ) : (
                    <span className="text-slate-400 italic">No active video — link may be from a deleted or unlisted video</span>
                  )}
                </td>
                <td className="hidden whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-500 sm:table-cell">
                  {redirectDomain}/{tag}
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-semibold text-slate-700">
                  {clicks.toLocaleString("en-US")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
