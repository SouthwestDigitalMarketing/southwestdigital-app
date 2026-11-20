import type { ScorecardData } from "./types";

/** Same cookie name as the Reports privacy toggle on ripley; each host keeps its own copy. */
export const PRIVACY_COOKIE = "swapp_privacy";

export function privacyOn(value: string | undefined): boolean {
  return value === "1";
}

/** "Client A" … "Client Z", then "Client AA", "Client AB" … */
export function clientAlias(index: number): string {
  let letters = "";
  let n = index;
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return `Client ${letters}`;
}

/**
 * Copy of the scorecard data that is safe to show on screen: client names become
 * Client A, B… (the same client gets the same letter everywhere on the page) and
 * sync failure notes, which can quote addresses or errors, are dropped. Runs on
 * the server so real names never reach the browser.
 */
export function privatizeScorecard(data: ScorecardData): ScorecardData {
  const aliases = new Map<string, string>();
  const alias = (name: string) => {
    const key = name.trim().toLowerCase();
    let found = aliases.get(key);
    if (!found) {
      found = clientAlias(aliases.size);
      aliases.set(key, found);
    }
    return found;
  };
  const waiting = [...data.waiting]
    .sort((a, b) => b.businessSecondsWaiting - a.businessSecondsWaiting)
    .map((item) => ({ ...item, contactName: item.contactName === null ? null : alias(item.contactName) }));
  return {
    ...data,
    waiting,
    reports: { ...data.reports, days: data.reports.days.map((row) => ({ ...row, client: alias(row.client) })) },
    syncs: data.syncs.map((sync) => ({ ...sync, note: null })),
  };
}
