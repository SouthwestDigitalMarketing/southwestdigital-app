export type VideoListItem = {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  /** Shown under the title, e.g. "Published Nov 16, 2026". */
  detail?: string;
  views: number;
  averageViewPercentage: number;
  estimatedMinutesWatched: number;
};

export function fmtWatchTime(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-base font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}

function watchUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * One video per row: thumbnail and full title, then labelled numbers underneath. Condensed: a small
 * thumbnail and the title only. Tapping opens YouTube.
 */
export function VideoList({
  videos,
  empty,
  condensed = false,
}: {
  videos: VideoListItem[];
  empty: string;
  condensed?: boolean;
}) {
  if (videos.length === 0) return <p className="my-3 text-sm text-slate-400">{empty}</p>;

  if (condensed) {
    return (
      <ul className="divide-y divide-slate-100">
        {videos.map((v) => (
          <li key={v.videoId}>
            <a
              href={watchUrl(v.videoId)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 py-2.5 hover:bg-slate-50"
            >
              <img
                src={v.thumbnailUrl}
                alt=""
                width={80}
                height={45}
                className="h-[45px] w-20 shrink-0 rounded object-cover"
              />
              <p className="min-w-0 text-sm font-medium leading-snug text-slate-900">{v.title}</p>
            </a>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="mt-4 divide-y divide-slate-100">
      {videos.map((v) => (
        <li key={v.videoId}>
          <a
            href={watchUrl(v.videoId)}
            target="_blank"
            rel="noopener noreferrer"
            className="block py-4 hover:bg-slate-50"
          >
            <div className="flex items-start gap-3">
              <img
                src={v.thumbnailUrl}
                alt=""
                width={128}
                height={72}
                className="h-[72px] w-32 shrink-0 rounded object-cover"
              />
              <div className="min-w-0">
                <p className="font-medium leading-snug text-slate-900">{v.title}</p>
                {v.detail ? <p className="mt-1 text-xs text-slate-500">{v.detail}</p> : null}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <Stat label="Views" value={v.views.toLocaleString("en-US")} />
              <Stat label="Avg % watched" value={`${v.averageViewPercentage.toFixed(1)}%`} />
              <Stat label="Watch time" value={fmtWatchTime(v.estimatedMinutesWatched)} />
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}
