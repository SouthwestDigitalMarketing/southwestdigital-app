export const PROPOSAL_PACKAGE_IDS = ["grow", "improve", "maintain"] as const;

export type PackageId = (typeof PROPOSAL_PACKAGE_IDS)[number];
export type ProposalPackageNames = Record<PackageId, string>;

export const DEFAULT_PROPOSAL_PACKAGE_NAMES: ProposalPackageNames = {
  grow: "Grow",
  improve: "Improve",
  maintain: "Maintain",
};

export function normalizeProposalPackageNames(value: unknown): ProposalPackageNames {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Partial<Record<PackageId, unknown>>
    : {};

  return Object.fromEntries(
    PROPOSAL_PACKAGE_IDS.map((id) => {
      const name = typeof record[id] === "string" ? record[id].trim() : "";
      return [id, name || DEFAULT_PROPOSAL_PACKAGE_NAMES[id]];
    }),
  ) as ProposalPackageNames;
}

export function resolveProposalPackageName(
  names: Partial<ProposalPackageNames> | null | undefined,
  id: PackageId,
) {
  return names?.[id]?.trim() || DEFAULT_PROPOSAL_PACKAGE_NAMES[id];
}

export function abbreviateProposalPackageName(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return Array.from(words[0])[0]?.toLocaleUpperCase() ?? "?";
  return words.slice(0, 2).map((word) => Array.from(word)[0]?.toLocaleUpperCase() ?? "").join("");
}
