"use client";

import { useRouter } from "next/navigation";
import { SendReviewDialog } from "./SendReviewDialog";

export function ReviewsHeader() {
  const router = useRouter();
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Reviews</h1>
        <p className="mt-1 text-sm text-slate-500">Send review requests and track outcomes</p>
      </div>
      <SendReviewDialog onSent={() => router.refresh()} />
    </div>
  );
}
