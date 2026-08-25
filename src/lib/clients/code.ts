export function normalizeClientCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

export function codeFromName(name: string): string {
  return normalizeClientCode(name) || "CLIENT";
}
