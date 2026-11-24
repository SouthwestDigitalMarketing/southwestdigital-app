import { ReleaseCalendar } from "./ReleaseCalendar";

export const dynamic = "force-dynamic";

/** Overview: the season calendar only (Tom, 2026-11-24). */
export default function OverviewPage() {
  return (
    <div className="px-4 py-5 sm:p-8">
      <h1 className="sr-only">Overview</h1>
      <ReleaseCalendar initialNow={new Date().toISOString()} />
    </div>
  );
}
