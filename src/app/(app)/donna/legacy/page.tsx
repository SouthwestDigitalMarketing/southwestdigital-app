import Link from "next/link";
import { ScanButton } from "@/components/ScanButton";
import { requireStaffBrand } from "@/lib/brands/staff";
import { isLochsideBrandSlug } from "@/lib/brands/active-brand";
import { prisma } from "@/lib/prisma";
import { loadReviewCounts, type ReviewCounts, type ReviewKind } from "@/lib/scan/reviews";
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
    <li className="min-w-0 break-words text-sm">
      <span className="text-slate-900">{row.severity === "urgent" ? "! " : ""}{row.what}</span>
      <span className="block text-xs text-slate-500">
        {roomLabel(row.room)}
        {" · "}
        {who}
        {" · "}
        {fixLevelLabel(row.fixLevel)}
        {" · "}
        last seen {formatWhen(row.lastSeenAt)}
      </span>
      <span className="mt-0.5 block whitespace-pre-wrap text-xs text-slate-600">{row.evidence}</span>
      {row.doneNote ? <span className="block text-xs text-slate-600">Done: {row.doneNote}</span> : null}
    </li>
  );
}

const MAIL_REVIEWS: { review: ReviewKind; label: string; href: string; unit: [string, string] }[] = [
  { review: "spam", label: "Spam", href: "/scanner/spam", unit: ["email", "emails"] },
  { review: "newsletter", label: "Newsletters", href: "/scanner/newsletters", unit: ["sender", "senders"] },
];

/** One line per mail review (was `/scan` in the terminal, Tom 2026-11-24). */
function MailReviewLines({ counts }: { counts: Record<ReviewKind, ReviewCounts> }) {
  return (
    <ol className="mt-3 space-y-1.5 text-sm">
      {MAIL_REVIEWS.map((item, index) => {
        const c = counts[item.review];
        const word = c.pending === 1 ? item.unit[0] : item.unit[1];
        return (
          <li key={item.review} className="flex min-w-0 items-baseline gap-2">
            <span className="w-5 shrink-0 text-right tabular-nums text-slate-400">{index + 1}.</span>
            <span className={c.pending > 0 || c.failed > 0 ? "text-amber-700" : "text-emerald-700"}>{c.pending > 0 || c.failed > 0 ? "!" : "✓"}</span>
            <span className="min-w-0 flex-1 break-words text-slate-800">
              {item.label}
              <span className="text-slate-500">
                {" — "}
                {c.pending > 0 ? `${c.pending} ${word} to check` : "all clear"}
                {c.answered > 0 ? ` · ${c.answered} being applied` : ""}
                {c.failed > 0 ? ` · ${c.failed} failed` : ""}
              </span>
              {c.pending > 0 || c.failed > 0 ? (
                <Link href={item.href} className="ml-1.5 whitespace-nowrap font-medium text-slate-900 underline decoration-slate-300 underline-offset-2">
                  Open
                </Link>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default async function ScannerPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { brand, dataContext, isPlatformOperator } = await requireStaffBrand();
  const mailReviews = isPlatformOperator && isLochsideBrandSlug(brand.slug) ? await loadReviewCounts(prisma) : null;
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
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900">Earlier scan findings</h1>
        {/* The Scan button moved here from the side menu and the top bar (Tom, 2026-11-24). */}
        {mailReviews ? <div className="w-full sm:w-64"><ScanButton /></div> : null}
      </div>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">
        One place for everything the scan found. Findings close on their own when the problem is gone; the mail reviews wait for your answer.
      </p>
      {onThisBrand ? null : (
        <p className="mt-3 text-sm text-slate-600">Scanner runs for Bookkeeping Conroe. This brand is {brand.name}.</p>
      )}

      <nav className="mt-4 flex flex-wrap gap-2" aria-label="Filter by role">
        <RoleLink href="/donna/legacy" current={role === null} label="All roles" />
        {SCAN_ROLES.map((item) => (
          <RoleLink
            key={item.key}
            href={`/donna/legacy?role=${item.key}`}
            current={role === item.key}
            label={roleNames.get(item.key) ?? item.label}
          />
        ))}
      </nav>

      {mailReviews ? (
        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Mail reviews</h2>
          <MailReviewLines counts={mailReviews} />
        </section>
      ) : null}

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
              <ol className="mt-3 space-y-3">
                {needsYou.map((row) => <FindingCard key={row.id} row={row} roles={roleNames} />)}
              </ol>
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
                  <ol className="mt-2 space-y-3">
                    {group.items.map((row) => <FindingCard key={row.id} row={row} roles={roleNames} />)}
                  </ol>
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
              <ol className="mt-3 space-y-3">
                {closed.map((row) => <FindingCard key={row.id} row={row} roles={roleNames} />)}
              </ol>
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
