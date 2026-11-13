import Link from "next/link";
import { requireStaffBrand } from "@/lib/brands/staff";
import { isScanStorageMissing } from "@/lib/scanner/post";
import { loadScanFindings } from "@/lib/scanner/load";
import { formatWhen, groupOpenByRoom, recentClosed, sortNeedsYou, type ScanListRow } from "@/lib/scanner/view";
import { SCAN_ROLES, SCANNER_BRAND_SLUG, fixLevelLabel, isScanRoleKey, roleLabel, roomLabel } from "@/lib/scanner/vocab";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ role?: string | string[] }>;

function one(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function FindingCard({ row, roles }: { row: ScanListRow; roles: Map<string, string> }) {
  const who = roles.get(row.roleKey) ?? roleLabel(row.roleKey);
  return (
    <article className="rounded-xl border border-slate-200 bg-white px-5 py-4">
      <h3 className="text-sm font-semibold text-slate-900">{row.what}</h3>
      <p className="mt-1 text-xs text-slate-500">
        {roomLabel(row.room)}
        {" · "}
        {who}
        {" · "}
        {fixLevelLabel(row.fixLevel)}
        {row.severity === "urgent" ? " · Urgent" : ""}
        {" · "}
        last seen {formatWhen(row.lastSeenAt)}
      </p>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-700">{row.evidence}</p>
      {row.doneNote ? <p className="mt-3 text-sm text-slate-600">Done: {row.doneNote}</p> : null}
    </article>
  );
}

export default async function ScannerPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { brand, dataContext } = await requireStaffBrand();
  const askedRole = one(params.role);
  let storageMissing = false;
  let roles: Array<{ key: string; label: string; holderLabel: string | null }> = [];
  let findings: ScanListRow[] = [];
  let role: string | null = askedRole && isScanRoleKey(askedRole) ? askedRole : null;

  try {
    const loaded = await loadScanFindings(dataContext, askedRole);
    roles = loaded.roles;
    findings = loaded.findings;
    role = loaded.role;
  } catch (error) {
    if (!isScanStorageMissing(error)) throw error;
    storageMissing = true;
  }

  const roleNames = new Map(roles.map((item) => [item.key, item.holderLabel ? `${item.label} · ${item.holderLabel}` : item.label]));
  const needsYou = sortNeedsYou(findings);
  const byRoom = groupOpenByRoom(findings);
  const closed = recentClosed(findings);
  const onThisBrand = brand.slug === SCANNER_BRAND_SLUG;

  return (
    <div className="p-8">
      <h1 className="text-lg font-semibold text-slate-900">Scanner</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">
        Log only. Nothing is fixed or sent from this page. Findings show up here when a worker posts them, and they close when the problem is gone.
      </p>
      {onThisBrand ? null : (
        <p className="mt-3 text-sm text-slate-600">Scanner runs for Bookkeeping Conroe. This brand is {brand.name}.</p>
      )}

      <nav className="mt-4 flex flex-wrap gap-2" aria-label="Filter by role">
        <RoleLink href="/scanner" current={role === null} label="All roles" />
        {SCAN_ROLES.map((item) => (
          <RoleLink
            key={item.key}
            href={`/scanner?role=${item.key}`}
            current={role === item.key}
            label={roleNames.get(item.key) ?? item.label}
          />
        ))}
      </nav>

      {storageMissing ? (
        <p className="mt-8 rounded-xl border border-slate-200 bg-white px-5 py-8 text-sm text-slate-600">
          The Scanner tables are not in the database yet. The SQL is written and waiting for a yes before it runs.
        </p>
      ) : (
        <>
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Needs you now ({needsYou.length})
            </h2>
            {needsYou.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Nothing needs you right now.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {needsYou.map((row) => <FindingCard key={row.id} row={row} roles={roleNames} />)}
              </div>
            )}
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">By room</h2>
            {byRoom.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No open findings.</p>
            ) : (
              byRoom.map((group) => (
                <div key={group.room} className="mt-4">
                  <h3 className="text-sm font-semibold text-slate-800">{group.label}</h3>
                  <div className="mt-2 space-y-3">
                    {group.items.map((row) => <FindingCard key={row.id} row={row} roles={roleNames} />)}
                  </div>
                </div>
              ))
            )}
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">What the butler fixed</h2>
            <p className="mt-1 text-xs text-slate-500">Closed because the problem was gone on a later check.</p>
            {closed.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Nothing closed yet.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {closed.map((row) => <FindingCard key={row.id} row={row} roles={roleNames} />)}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function RoleLink({ href, label, current }: { href: string; label: string; current: boolean }) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`rounded-full border px-3 py-1 text-sm ${
        current ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"
      }`}
    >
      {label}
    </Link>
  );
}
