// Scorecard sections shown on the Dashboard (Tom, 2026-11-20: merge Dashboard and
// Scorecard). Server components; the data comes from the Dashboard page.
import Link from "next/link";
import { BookCheck, FileText, Gauge, ListChecks, Mail, MessageSquare, MessagesSquare, Phone } from "lucide-react";
import type { ScorecardTotals, TotalFigure } from "@/lib/scorecard/totals";
import type {
  MeasureSummary,
  ScorecardChannel,
  ScorecardData,
  ScorecardRange,
  ScorecardSource,
} from "@/lib/scorecard/types";
import { ScorecardCharts } from "./ScorecardCharts";
import { TotalsChart } from "./TotalsChart";
import {
  CHANNEL_LABEL,
  DAILY_SYNC_STALE_SECONDS,
  REPORTS_TRACKING_STARTS,
  SCORECARD_RANGES,
  formatAgo,
  formatDate,
  formatDuration,
  formatMonth,
  formatShare,
  isStale,
  measureFigures,
  targetWords,
  type DurationBasis,
} from "./format";

const SOURCE_LABEL: Record<ScorecardSource, string> = {
  quo: "Quo (texts and calls)",
  zoho: "Zoho (email)",
  reports: "Reports",
  qbo: "QuickBooks (nightly)",
};

// Below this many delivered reports the card says tracking only just started.
const FEW_REPORTS = 3;

const count = (n: number) => n.toLocaleString("en-US");

function BigNumber({
  title,
  icon,
  figure,
  caption,
}: {
  title: string;
  icon: React.ReactNode;
  figure: Omit<TotalFigure, "months">;
  caption: string;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex items-center gap-1.5 text-slate-400">
        {icon}
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">{title}</h2>
      </div>
      {figure.since === null ? (
        <p className="mt-3 text-sm text-slate-400">Not counted yet. The nightly count fills this in.</p>
      ) : (
        <>
          <p className="mt-2 text-4xl font-semibold tabular-nums sm:text-5xl" style={{ color: "var(--text-primary)" }}>
            {count(figure.allTime)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {caption} since {formatMonth(figure.since)}
          </p>
          <Facts
            rows={[
              ["This month", count(figure.thisMonth)],
              ["Last month", count(figure.lastMonth)],
            ]}
          />
        </>
      )}
    </div>
  );
}

/** All-time totals; they ignore the range picker. */
export function BigNumbers({ totals }: { totals: ScorecardTotals }) {
  return (
    <section className="mt-6" aria-label="All-time totals">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <BigNumber
          title="Transactions recorded"
          icon={<BookCheck size={14} />}
          figure={totals.transactions}
          caption="in clients' books by our team"
        />
        <BigNumber title="Reports issued" icon={<FileText size={14} />} figure={totals.reports} caption="monthly reports" />
        <BigNumber
          title="Client messages answered"
          icon={<MessagesSquare size={14} />}
          figure={totals.messages}
          caption="texts, calls and emails"
        />
      </div>
      <TotalsChart transactions={totals.transactions.months} reports={totals.reports.months} />
    </section>
  );
}

export function LiveStrip({ data, now }: { data: ScorecardData; now: Date }) {
  return (
    <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-[3fr_2fr] sm:gap-4">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-baseline justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Waiting for a reply</h2>
          <span className="text-xs text-slate-400">{data.waiting.length}</span>
        </div>
        {data.waiting.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400">No client is waiting on us.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {[...data.waiting]
              .sort((a, b) => b.businessSecondsWaiting - a.businessSecondsWaiting)
              .map((item) => (
                <li
                  key={`${item.channel}|${item.startedAt}|${item.contactName ?? ""}`}
                  className="flex items-center justify-between gap-3 px-4 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-900">
                      {item.contactName ?? "Unnamed client"}
                    </span>
                    <span className="text-xs text-slate-500">
                      {CHANNEL_LABEL[item.channel]} · came in {formatAgo(item.startedAt, now)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-sm font-semibold tabular-nums text-slate-900">
                    {formatDuration(item.businessSecondsWaiting, "business")}
                    <span className="block text-[11px] font-normal text-slate-400">business time</span>
                  </span>
                </li>
              ))}
          </ul>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-baseline justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last sync</h2>
          <span className="text-xs text-slate-400">refreshes every 5 minutes</span>
        </div>
        {data.syncs.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-amber-700">No source has synced yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.syncs.map((sync) => {
              const stale = isStale(sync.lastRunAt, now, sync.source === "qbo" ? DAILY_SYNC_STALE_SECONDS : undefined);
              const tone = !sync.ok ? "text-red-700" : stale ? "text-amber-700" : "text-slate-600";
              return (
                <li key={sync.source} className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 text-slate-900">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          !sync.ok ? "bg-red-500" : stale ? "bg-amber-400" : "bg-emerald-500"
                        }`}
                        aria-hidden
                      />
                      {SOURCE_LABEL[sync.source]}
                    </span>
                    <span className={`shrink-0 text-xs tabular-nums ${tone}`}>
                      {formatAgo(sync.lastRunAt, now)}
                      {!sync.ok ? " · failed" : stale ? " · stale" : ""}
                    </span>
                  </div>
                  {!sync.ok && sync.note ? (
                    <p className="mt-0.5 truncate pl-4 text-xs text-red-700">{sync.note}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex items-center gap-1.5 text-slate-400">
        {icon}
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Big({ value, caption }: { value: string; caption: string }) {
  return (
    <div className="mt-2">
      <p className="text-2xl font-semibold tabular-nums sm:text-3xl" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
      <p className="text-xs text-slate-500">{caption}</p>
    </div>
  );
}

function Facts({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-slate-500">{label}</dt>
          <dd className="text-right font-medium tabular-nums text-slate-800">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm text-slate-400">{children}</p>;
}

/**
 * Median, p90, counts and the target share for one measure. `basis` picks the
 * figures: business time (plus the clock median), or calendar days for reports.
 */
function MeasureBody({
  summary,
  channel,
  basis = "business",
  noun = "client contacts",
  caption = "median, business hours",
}: {
  summary: MeasureSummary;
  channel: ScorecardChannel;
  basis?: DurationBasis;
  noun?: string;
  caption?: string;
}) {
  if (summary.count === 0) return <Empty>No {noun} in this range</Empty>;
  const figures = measureFigures(summary, basis);
  return (
    <>
      {figures ? (
        <Big value={figures.median} caption={caption} />
      ) : (
        <Big value="None answered" caption={`${summary.count} still open`} />
      )}
      <Facts
        rows={[
          ...(figures ? ([["90th percentile", figures.p90], ...figures.extra] as [string, string][]) : []),
          ["Answered", `${summary.answered} of ${summary.count}`],
          [`On target (${targetWords(channel, summary.targetSeconds)})`, formatShare(summary.withinTargetShare)],
        ]}
      />
    </>
  );
}

function MeasureCard({
  title,
  icon,
  channel,
  summary,
}: {
  title: string;
  icon: React.ReactNode;
  channel: ScorecardChannel;
  summary: MeasureSummary;
}) {
  return (
    <Card title={title} icon={icon}>
      <MeasureBody summary={summary} channel={channel} />
    </Card>
  );
}

function CallsCard({ calls }: { calls: ScorecardData["calls"] }) {
  const { callback } = calls;
  return (
    <Card title="Calls" icon={<Phone size={14} />}>
      {calls.incoming === 0 ? (
        <Empty>No client contacts in this range</Empty>
      ) : (
        <>
          <Big value={formatShare(calls.answeredShare)} caption={`answered live, ${calls.answeredLive} of ${calls.incoming}`} />
          <Facts
            rows={[
              ["Missed", String(calls.missed)],
              ["Left a voicemail", String(calls.voicemails)],
              ...(callback.count === 0
                ? []
                : ([
                    [
                      "Callback median",
                      callback.medianSeconds === null ? "none yet" : formatDuration(callback.medianSeconds, "business"),
                    ],
                    ["Callback 90th percentile", callback.p90Seconds === null ? "—" : formatDuration(callback.p90Seconds, "business")],
                    ["Called back", `${callback.answered} of ${callback.count}`],
                    [
                      `Callback on target (${targetWords("call", callback.targetSeconds)})`,
                      formatShare(callback.withinTargetShare),
                    ],
                  ] as [string, string][])),
            ]}
          />
        </>
      )}
    </Card>
  );
}

function ReportsCard({ reports }: { reports: ScorecardData["reports"] }) {
  return (
    <Card title="Reports" icon={<FileText size={14} />}>
      {reports.count < FEW_REPORTS ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Tracking started {formatDate(REPORTS_TRACKING_STARTS)}. Older reports have no trustworthy publish
          date, so they are not counted.
        </p>
      ) : null}
      <MeasureBody
        summary={reports}
        channel="report"
        basis="clock"
        noun="reports due"
        caption="median, calendar days from month end to published"
      />
      {reports.days.length > 0 ? (
        <ul className="mt-3 space-y-1 border-t border-slate-100 pt-2 text-xs">
          {reports.days.map((row) => (
            <li key={`${row.client}|${row.month}`} className="flex justify-between gap-3">
              <span className="truncate text-slate-600">
                {row.client} · {formatMonth(row.month)}
              </span>
              <span className="shrink-0 tabular-nums text-slate-800">
                {row.days} day{row.days === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

function DutiesCard({ duties }: { duties: ScorecardData["duties"] }) {
  return (
    <Card title="Duties" icon={<ListChecks size={14} />}>
      {duties.due === 0 ? (
        <Empty>No duties were due in this range. Tracking started {formatDate(duties.trackingStarts)}.</Empty>
      ) : (
        <>
          <Big value={formatShare(duties.onTimeShare)} caption={`done on time, ${duties.doneOnTime} of ${duties.due}`} />
          <Facts
            rows={[
              ["Done late", String(duties.doneLate)],
              ["Not done", String(duties.notDone)],
              ["Tracking started", formatDate(duties.trackingStarts)],
            ]}
          />
        </>
      )}
    </Card>
  );
}

export function HowWeMeasure({ businessHours }: { businessHours: string }) {
  return (
    <details className="group mt-5 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 sm:mt-6 sm:p-6">
      <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-wide text-slate-500">
        How we measure response times and totals <span className="normal-case text-slate-400 group-open:hidden">· show</span>
      </summary>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>
          <strong className="font-medium text-slate-800">Clients only.</strong> A contact counts once they
          have a service record, from their first service date. Leads, spam, newsletters, vendors and our own
          addresses never count.
        </li>
        <li>
          <strong className="font-medium text-slate-800">Business hours:</strong> {businessHours}. Time outside
          those hours does not count. The &ldquo;on the clock&rdquo; number counts every hour, nights and
          weekends included.
        </li>
        <li>
          <strong className="font-medium text-slate-800">Median</strong> is the middle answer: half were
          faster, half slower. <strong className="font-medium text-slate-800">90th percentile</strong> means 9
          in 10 were answered at least that fast. We never show an average alone.
        </li>
        <li>
          A text or email counts once per burst: several messages in a row before we answer are one wait. A
          missed call is answered by our first call or text back. A report is timed from the last day of its
          month to the day it is published.
        </li>
        <li>Times come straight from Quo, Zoho and our reports log. No message text is stored.</li>
        <li>
          <strong className="font-medium text-slate-800">All-time totals</strong> are counted nightly:
          transactions our team entered or last changed in clients&rsquo; QuickBooks books, published
          monthly reports, and answered client texts, calls and emails.
        </li>
      </ul>
    </details>
  );
}

/**
 * Texts, calls, emails, reports and duties for the response-time range (its own
 * picker, `rt`, separate from the Dashboard's reporting period), plus the 90-day graphs.
 */
export function ResponseTimes({
  data,
  range,
  hrefFor,
}: {
  data: ScorecardData;
  range: ScorecardRange;
  hrefFor: (range: ScorecardRange) => string;
}) {
  const rangeLabel = data.from === data.to ? formatDate(data.to) : `${formatDate(data.from)} – ${formatDate(data.to)}`;
  return (
    <section id="response-times" className="mt-5 scroll-mt-4 sm:mt-6" aria-labelledby="response-times-title">
      <div className="mb-2 flex flex-col gap-2 sm:mb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-slate-500">
            <Gauge size={14} className="shrink-0" />
            <h2 id="response-times-title" className="text-xs font-semibold uppercase tracking-wide">
              Response times
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">How fast we answer clients · {rangeLabel}</p>
        </div>
        <nav className="flex gap-1 self-start rounded-lg border border-slate-200 bg-white p-1" aria-label="Response-time range">
          {SCORECARD_RANGES.map(({ value, label }) => (
            <Link
              key={value}
              href={hrefFor(value)}
              scroll={false}
              aria-current={range === value ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                range === value ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        <MeasureCard title="Texts" icon={<MessageSquare size={14} />} channel="text" summary={data.texts} />
        <CallsCard calls={data.calls} />
        <MeasureCard title="Emails" icon={<Mail size={14} />} channel="email" summary={data.emails} />
        <ReportsCard reports={data.reports} />
        <DutiesCard duties={data.duties} />
      </div>
      <ScorecardCharts
        series={data.series}
        targetSeconds={{
          texts: data.texts.targetSeconds,
          emails: data.emails.targetSeconds,
          callbacks: data.calls.callback.targetSeconds,
        }}
      />
    </section>
  );
}
