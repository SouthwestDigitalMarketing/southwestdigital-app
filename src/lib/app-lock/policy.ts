/**
 * Who must use the app lock (Tom, 2026-11-21: "just my accounts"). Everyone
 * else may turn it on from Settings → Security; once they have a PIN the lock
 * applies to them too.
 */
export const PIN_REQUIRED_EMAILS: readonly string[] = [
  "thomas@bookkeepingconroe.com",
  "thomas@realestatebookkeeper.com",
  "tmacdonald7@gmail.com",
];

export function pinRequired(email: string | null | undefined): boolean {
  return Boolean(email) && PIN_REQUIRED_EMAILS.includes(email!.trim().toLowerCase());
}
