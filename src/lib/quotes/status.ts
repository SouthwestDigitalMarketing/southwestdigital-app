export const OFFER_BUCKETS = ["draft", "completed", "archived"] as const;

export type OfferBucket = (typeof OFFER_BUCKETS)[number];

export function parseOfferBucket(raw: string | undefined): OfferBucket {
  if (raw === "completed" || raw === "archived") return raw;
  return "draft";
}

export function statusesForBucket(bucket: OfferBucket): string[] {
  if (bucket === "draft") return ["draft"];
  if (bucket === "archived") return ["archived"];
  return ["completed", "sent", "accepted", "rejected"];
}

export function bucketForStatus(status: string): OfferBucket {
  if (status === "archived") return "archived";
  if (status === "draft") return "draft";
  return "completed";
}

export function outcomeLabel(status: string): string {
  if (status === "accepted") return "Accepted";
  if (status === "rejected") return "Rejected";
  if (status === "sent") return "Awaiting reply";
  return BUCKET_LABEL[bucketForStatus(status)];
}

export const BUCKET_LABEL: Record<OfferBucket, string> = {
  draft: "Draft",
  completed: "Completed",
  archived: "Archived",
};
