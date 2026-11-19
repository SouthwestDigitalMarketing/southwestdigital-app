// Shown the moment Reports is tapped, while the server signs the link to ripley's Reports page,
// so the previous page (the Dashboard) never flashes before the reports open (Tom, 2026-11-19).
export default function ReportsLoading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-4" role="status" aria-live="polite">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border)] border-t-slate-700" />
      <p className="text-base text-slate-600">Opening Reports…</p>
    </div>
  );
}
