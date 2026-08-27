const EMAIL_PATTERN = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i;

export function normalizeEmailInput(raw: string): string {
  return raw
    .trim()
    .replace(/^mailto:/i, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

export function isValidEmail(raw: string): boolean {
  const email = normalizeEmailInput(raw);
  if (!email) return false;
  if (email.includes("..")) return false;
  if (email.startsWith(".") || email.includes(".@") || email.includes("@.")) return false;
  return EMAIL_PATTERN.test(email);
}

export function parseEmailOrThrow(raw: string): string | null {
  const email = normalizeEmailInput(raw);
  if (!email) return null;
  if (!isValidEmail(email)) {
    throw new Error("Enter a valid email address, like name@company.com.");
  }
  return email;
}
