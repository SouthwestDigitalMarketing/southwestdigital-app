// Shown the moment any sidebar item is tapped, while the server renders the page, so the
// previous page (usually the Dashboard) never stays on screen after the menu closes (Tom,
// 2026-11-20: "briefly shown the dashboard before the scorecard"). Pages with their own
// loading.tsx (Dashboard, Reports) keep theirs.
export default function AppLoading() {
  return (
    <div className="space-y-5 px-4 py-5 sm:p-8" role="status" aria-live="polite">
      <span className="sr-only">Loading</span>
      <div className="h-7 w-48 animate-pulse rounded bg-[var(--border)]" />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="h-24 animate-pulse rounded-2xl bg-[var(--surface)] shadow-sm ring-1 ring-[var(--border)]" />
        <div className="h-24 animate-pulse rounded-2xl bg-[var(--surface)] shadow-sm ring-1 ring-[var(--border)]" />
        <div className="h-24 animate-pulse rounded-2xl bg-[var(--surface)] shadow-sm ring-1 ring-[var(--border)]" />
      </div>
      <div className="h-64 w-full animate-pulse rounded-2xl bg-[var(--surface)] shadow-sm ring-1 ring-[var(--border)]" />
    </div>
  );
}
