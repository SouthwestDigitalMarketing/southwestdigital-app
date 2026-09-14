import { prisma } from "@/lib/prisma";
import { requireAppBrand } from "@/lib/brands/staff";
import { ReviewOutcome } from "@prisma/client";
import { ReviewsHeader } from "./ReviewsHeader";
import { formatPhone } from "@/lib/phone";
import { canSendReviewReminder } from "@/lib/reviews/policy";
import { SendReminderButton } from "./SendReminderButton";

export default async function ReviewsPage() {
  const { brand } = await requireAppBrand();

  const [requests, total, opened, googleClicked, feedback] = await Promise.all([
    prisma.reviewRequest.findMany({
      where: { brandId: brand.id },
      orderBy: { sentAt: "desc" },
      take: 100,
      select: {
        id: true,
        token: true,
        recipientName: true,
        recipientPhone: true,
        channel: true,
        sentAt: true,
        lastReminderAt: true,
        openedAt: true,
        clickedAt: true,
        outcome: true,
        feedbackRating: true,
      },
    }),
    prisma.reviewRequest.count({ where: { brandId: brand.id } }),
    prisma.reviewRequest.count({ where: { brandId: brand.id, openedAt: { not: null } } }),
    prisma.reviewRequest.count({
      where: {
        brandId: brand.id,
        OR: [{ clickedAt: { not: null } }, { outcome: ReviewOutcome.FIVE_STAR }],
      },
    }),
    prisma.reviewRequest.count({
      where: { brandId: brand.id, outcome: ReviewOutcome.FEEDBACK },
    }),
  ]);

  const openRate = total > 0 ? Math.round((opened / total) * 100) : 0;
  const googleClickedRate = total > 0 ? Math.round((googleClicked / total) * 100) : 0;

  return (
    <div className="p-8">
      <ReviewsHeader />

      {/* Stats */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total sent", value: total },
          { label: "Open rate", value: `${openRate}%` },
          { label: "Google clicked", value: `${googleClickedRate}%` },
          { label: "Feedback received", value: feedback },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-3xl font-semibold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Request history</p>
          {total > requests.length ? (
            <p className="mt-1 text-xs text-slate-400">
              Showing {requests.length} of {total.toLocaleString("en-US")}
            </p>
          ) : null}
        </div>
        {requests.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-400">
            No review requests sent yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="px-5 py-3 text-sm font-semibold normal-case text-slate-700">Recipient</th>
                <th className="px-5 py-3 text-sm font-semibold normal-case text-slate-700">Phone</th>
                <th className="px-5 py-3 text-sm font-semibold normal-case text-slate-700">First Sent</th>
                <th className="px-5 py-3 text-sm font-semibold normal-case text-slate-700">Last Reminder</th>
                <th className="px-5 py-3 text-sm font-semibold normal-case text-slate-700">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900">{r.recipientName ?? "—"}</td>
                  <td className="px-5 py-3 text-slate-500">{r.recipientPhone ? formatPhone(r.recipientPhone) : "—"}</td>
                  <td className="px-5 py-3 text-slate-500">
                    {new Date(r.sentAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-5 py-3 text-slate-500">
                    {r.lastReminderAt
                      ? new Date(r.lastReminderAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <StatusChip request={r} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    {canSendReviewReminder(r) ? <SendReminderButton requestId={r.id} /> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatusChip({
  request,
}: {
  request: { outcome: ReviewOutcome | null; openedAt: Date | null; clickedAt: Date | null };
}) {
  if (request.outcome === ReviewOutcome.FEEDBACK) {
    return (
      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
        Feedback
      </span>
    );
  }
  if (request.clickedAt || request.outcome === ReviewOutcome.FIVE_STAR) {
    return (
      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        Google clicked
      </span>
    );
  }
  if (request.openedAt) {
    return (
      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
        Opened
      </span>
    );
  }
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
      Sent
    </span>
  );
}
