export default function DashboardLoading() {
  return (
    <div className="space-y-5 px-4 py-5 sm:p-8" role="status" aria-live="polite">
      <span className="sr-only">Loading dashboard</span>
      <div className="h-7 w-56 animate-pulse rounded bg-[var(--border)]" />
      <div className="h-12 w-full animate-pulse rounded-xl bg-[var(--border)]" />
      <div className="space-y-3">
        <div className="h-5 w-28 animate-pulse rounded bg-[var(--border)]" />
        <div className="h-28 w-full animate-pulse rounded-2xl bg-[var(--surface)] shadow-sm ring-1 ring-[var(--border)]" />
      </div>
      <div className="space-y-3">
        <div className="h-5 w-32 animate-pulse rounded bg-[var(--border)]" />
        <div className="h-32 w-full animate-pulse rounded-2xl bg-[var(--surface)] shadow-sm ring-1 ring-[var(--border)]" />
      </div>
    </div>
  );
}
