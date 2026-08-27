export const PHONE_COUNTRY_OPTIONS = [
  { code: "+1", label: "US/CA +1" },
  { code: "+44", label: "UK +44" },
  { code: "+61", label: "AU +61" },
  { code: "+64", label: "NZ +64" },
  { code: "+52", label: "MX +52" },
  { code: "+91", label: "IN +91" },
  { code: "+353", label: "IE +353" },
] as const;

export function formatNationalNumber(countryCode: string, raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (countryCode === "+1") {
    const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits.slice(0, 10);
    if (national.length <= 3) return national;
    if (national.length <= 6) return `(${national.slice(0, 3)}) ${national.slice(3)}`;
    return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
  }
  return digits.slice(0, 14);
}

export function splitStoredPhone(raw: string | null | undefined): {
  countryCode: string;
  national: string;
} {
  if (!raw) return { countryCode: "+1", national: "" };
  const compact = raw.replace(/[^\d+]/g, "");
  const match = compact.match(/^\+(\d{1,4})(\d{6,14})$/);
  if (!match) {
    return { countryCode: "+1", national: formatNationalNumber("+1", raw) };
  }
  const rest = match[2];
  const known = PHONE_COUNTRY_OPTIONS.map((option) => option.code.replace("+", "")).sort(
    (a, b) => b.length - a.length,
  );
  const prefix = known.find((code) => (match[1] + rest).startsWith(code));
  if (!prefix) {
    return { countryCode: `+${match[1]}`, national: rest };
  }
  const nationalDigits = (match[1] + rest).slice(prefix.length);
  const countryCode = `+${prefix}`;
  return { countryCode, national: formatNationalNumber(countryCode, nationalDigits) };
}

export function toE164(countryCode: string, national: string): string | null {
  const nationalDigits = national.replace(/\D/g, "");
  if (!nationalDigits) return null;
  const code = /^\+\d{1,4}$/.test(countryCode) ? countryCode : "+1";
  if (code === "+1") {
    const ten =
      nationalDigits.length === 11 && nationalDigits.startsWith("1")
        ? nationalDigits.slice(1)
        : nationalDigits;
    if (ten.length !== 10) {
      throw new Error("Enter a 10-digit US/Canada number, like (555) 123-4567.");
    }
    return `+1${ten}`;
  }
  if (nationalDigits.length < 6 || nationalDigits.length > 14) {
    throw new Error("Enter a valid phone number for the selected country.");
  }
  return `${code}${nationalDigits}`;
}

export function parseSubmittedPhone(raw: string): string | null {
  const compact = raw.trim().replace(/[^\d+]/g, "");
  if (!compact) return null;
  if (/^\+\d{8,15}$/.test(compact)) return compact;
  return normalizePhone(raw);
}

// Strips formatting and returns E.164 for US numbers ("+15551234567").
// Throws a user-friendly error for anything that can't be resolved.
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  throw new Error("Enter a 10-digit US/Canada number, like (555) 123-4567.");
}

// Formats any US phone (stored E.164 or raw digits) as "+1 (555) 123-4567".
// Falls back to the raw value if it can't be parsed.
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const ten = digits.length === 10 ? digits : digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : null;
  if (!ten) return raw;
  return `+1 (${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}
