"use client";

import { useRouter } from "next/navigation";
import { SendReviewDialog } from "./SendReviewDialog";

export function ReviewsHeader() {
  const router = useRouter();
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="sr-only">Reviews</h1>
        <h2 className="text-lg font-semibold text-slate-900">Review requests</h2>
      </div>
      <SendReviewDialog onSent={() => router.refresh()} />
    </div>
  );
}
