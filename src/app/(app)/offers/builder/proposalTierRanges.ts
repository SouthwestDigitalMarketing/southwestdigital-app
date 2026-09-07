import type { PackageId } from "./proposalPackageNames";

export const TIER_ORDER: PackageId[] = ["maintain", "improve", "grow"];

export type TierRange = {
  from: PackageId;
  to: PackageId;
};

export function normalizeTierPackageIds(value: unknown): PackageId[] {
  if (!Array.isArray(value)) return [];
  const selected = TIER_ORDER.filter((id) => value.includes(id));
  if (selected.length < 2) return selected;
  const first = TIER_ORDER.indexOf(selected[0]);
  const last = TIER_ORDER.indexOf(selected[selected.length - 1]);
  return TIER_ORDER.slice(first, last + 1);
}

export function tierRangeFromPackageIds(value: unknown): TierRange | null {
  const ids = normalizeTierPackageIds(value);
  if (ids.length === 0) return null;
  return { from: ids[0], to: ids[ids.length - 1] };
}

export function packageIdsFromTierRange(range: TierRange | null): PackageId[] {
  if (!range) return [];
  const from = TIER_ORDER.indexOf(range.from);
  const to = TIER_ORDER.indexOf(range.to);
  if (from < 0 || to < 0) return [];
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  return TIER_ORDER.slice(start, end + 1);
}

export function tierRangeLabel(range: TierRange | null, labels: Record<PackageId, string>) {
  if (!range) return "None";
  const from = labels[range.from];
  const to = labels[range.to];
  return from === to ? from : `${from} through ${to}`;
}
