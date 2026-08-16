import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveBrand } from "@/lib/brands/resolve";
import { MembershipStatus, ReviewOutcome } from "@prisma/client";
import { ReviewsHeader } from "./ReviewsHeader";

export default async function ReviewsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const headersList = await headers();
  const resolved = await resolveBrand(headersList.get("x-hostname"), session.user.id);
  if (!resolved?.membership || resolved.membership.status !== MembershipStatus.ACTIVE) {
    redirect("/dashboard");
  }

  const { brand } = resolved;

  const requests = await prisma.reviewRequest.findMany({
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
      openedAt: true,
      outcome: true,
      feedbackRating: true,
    },
  });

  const total = requests.length;
  const opened = requests.filter((r) => r.openedAt).length;
  const fiveStars = requests.filter((r) => r.outcome === ReviewOutcome.FIVE_STAR).length;

  const openRate = total > 0 ? Math.round((opened / total) * 100) : 0;
  const starRate = total > 0 ? Math.round((fiveStars / total) * 100) : 0;

  return (
    <div className="p-8">
      <ReviewsHeader />

      {/* Stats */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        {[
          { label: "Total sent", value: total },
          { label: "Open rate", value: `${openRate}%` },
          { label: "5-star rate", value: `${starRate}%` },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-3xl font-semibold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {requests.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-400">
            No review requests sent yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Recipient</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Sent</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900">{r.recipientName ?? "—"}</td>
                  <td className="px-5 py-3 text-slate-500">{r.recipientPhone ?? "—"}</td>
                  <td className="px-5 py-3 text-slate-500">
                    {new Date(r.sentAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-5 py-3">
                    <StatusChip request={r} />
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
  request: { outcome: ReviewOutcome | null; openedAt: Date | null };
}) {
  if (request.outcome === ReviewOutcome.FIVE_STAR) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        ★ 5 Stars
      </span>
    );
  }
  if (request.outcome === ReviewOutcome.FEEDBACK) {
    return (
      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
        Feedback
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
