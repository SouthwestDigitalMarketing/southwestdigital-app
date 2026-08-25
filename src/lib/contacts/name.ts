export function splitContactName(value: string | null | undefined) {
  const parts = (value ?? "")
    .replace(/^(mr|mrs|ms|dr)\.?\s+/i, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

export function formatEvenOwnershipShare(ownerCount: number) {
  if (ownerCount <= 0) return "";
  const share = 100 / ownerCount;
  return Number.isInteger(share) ? String(share) : share.toFixed(2);
}
