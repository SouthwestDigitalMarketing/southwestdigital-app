// Strips formatting and returns E.164 for US numbers ("+15551234567").
// Throws a user-friendly error for anything that can't be resolved.
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  throw new Error("Invalid phone number — please enter a 10-digit US number.");
}

// Formats any US phone (stored E.164 or raw digits) as "+1 (555) 123-4567".
// Falls back to the raw value if it can't be parsed.
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const ten = digits.length === 10 ? digits : digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : null;
  if (!ten) return raw;
  return `+1 (${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}
