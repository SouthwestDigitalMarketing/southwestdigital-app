import { createAliaser, type Aliaser } from "@/lib/privacy/alias";
import type { ScorecardData } from "./types";

/**
 * Copy of the scorecard data that is safe to show on screen: client names become
 * Client A, B… (the same client gets the same letter everywhere on the page) and
 * sync failure notes, which can quote addresses or errors, are dropped. Runs on
 * the server so real names never reach the browser. Pass the page's aliaser so a
 * client keeps one letter across every section.
 */
export function privatizeScorecard(data: ScorecardData, alias: Aliaser = createAliaser()): ScorecardData {
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
