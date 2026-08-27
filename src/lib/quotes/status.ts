export const OFFER_BUCKETS = ["draft", "sent", "completed", "archived"] as const;

export type OfferBucket = (typeof OFFER_BUCKETS)[number];

export function parseOfferBucket(raw: string | undefined): OfferBucket {
  if (raw === "sent" || raw === "completed" || raw === "archived") return raw;
  return "draft";
}

export const ACTIVE_OFFER_STATUSES = ["draft", "sent", "completed", "accepted", "rejected"] as const;

export type OfferStatusFilter = "all" | "draft" | "sent" | "completed";

export function parseOfferStatusFilter(raw: string | undefined): OfferStatusFilter {
  if (raw === "draft" || raw === "sent" || raw === "completed") return raw;
  return "all";
}

export function parseArchivedView(raw: string | undefined): boolean {
  return raw === "1" || raw === "true";
}

export function statusesForBucket(bucket: OfferBucket): string[] {
  if (bucket === "draft") return ["draft"];
  if (bucket === "sent") return ["sent"];
  if (bucket === "archived") return ["archived"];
  return ["completed", "accepted", "rejected"];
}

export function statusesForOfferList(input: {
  archived: boolean;
  statusFilter: OfferStatusFilter;
}): string[] {
  if (input.archived) return ["archived"];
  if (input.statusFilter === "all") return [...ACTIVE_OFFER_STATUSES];
  return statusesForBucket(input.statusFilter);
}

export function bucketForStatus(status: string): OfferBucket {
  if (status === "archived") return "archived";
  if (status === "draft") return "draft";
  if (status === "sent") return "sent";
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
  sent: "Sent",
  completed: "Completed",
  archived: "Archived",
};
