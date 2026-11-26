export const PAGE_SIZE = 50;

export type ContactTagKindName =
  | "CUSTOM"
  | "SERVICES"
  | "LEAD"
  | "INDUSTRY"
  | "STATUS"
  | "REVIEWS_GIVEN";

export const TAG_KIND_LABELS: Record<ContactTagKindName, string> = {
  SERVICES: "Services",
  LEAD: "Lead",
  INDUSTRY: "Industry",
  STATUS: "Status",
  REVIEWS_GIVEN: "Review given",
  CUSTOM: "Custom",
};

export function slugifyTagKey(label: string): string {
  const key = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return key || "tag";
}

export type ContactSort = "name" | "name-desc" | "updated" | "created";

export function parseContactSort(raw: string | undefined): ContactSort {
  if (raw === "name-desc" || raw === "updated" || raw === "created") return raw;
  return "name";
}

export function parseStatusFilter(raw: string | undefined): "all" | "active" | "inactive" {
  if (raw === "active" || raw === "inactive") return raw;
  return "all";
}

export const RELATIONSHIP_TAGS = [
  { key: "close-friend", label: "Close friend", sortOrder: 1 },
  { key: "friend", label: "Friend", sortOrder: 2 },
  { key: "client", label: "Client", sortOrder: 3 },
] as const;

export type ContactRelationship = "all" | (typeof RELATIONSHIP_TAGS)[number]["key"];

/** Extra keys that already mean "this person is a bookkeeping client". */
export const CLIENT_RELATIONSHIP_TAG_KEYS = ["client", "active-client"] as const;

export function parseRelationship(raw: string | undefined): ContactRelationship {
  if (raw === "close-friend" || raw === "friend" || raw === "client") return raw;
  return "all";
}

export function parseTagKeys(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  const values = Array.isArray(raw) ? raw : raw.split(",");
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}
