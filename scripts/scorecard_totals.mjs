#!/usr/bin/env node
// Scorecard big numbers, counted nightly on ripley (docs/scorecard.md § Big numbers).
//
//   transactions  QuickBooks transactions in each client's books that our team
//                 entered (Created By) or last changed (Last Modified By), counted
//                 in the month that happened. Read-only QuickBooks Transaction
//                 List reports through bookbot-app's own connection and token
//                 refresh, so this never races qb over the saved tokens.
//   reports       Published monthly reports: <REPORTS_ROOT>/<client>/reports/<year>/<YYYY-MM>.pdf,
//                 counted by the month each report covers.
//
// Only one number per metric per month is posted to SWapp (POST /api/scorecard/totals).
// No client names, transactions or report contents leave ripley.
//
//   node scripts/scorecard_totals.mjs [--dry-run] [--only transactions|reports]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const HOME = os.homedir();
const BRAND = "bookkeeping-conroe";
const DEFAULT_BASE = "https://admin.southwestdigital.io";
const OPS_ENV = process.env.SWAPP_OPERATIONS_ENV ?? path.join(HOME, ".config/swapp/operations.env");
const CONFIG = process.env.SCORECARD_TOTALS_CONFIG ?? path.join(HOME, ".config/swapp-scorecard/totals.json");
const BOOKBOT_ROOT = process.env.BOOKBOT_ROOT ?? path.join(HOME, "projects/bookbot-app");
const REPORTS_ROOT = process.env.PHONE_INTAKE_REPORTS_ROOT ?? path.join(HOME, "projects/clients");
const HTTP_TIMEOUT_MS = 60_000;

/** Defaults; ~/.config/swapp-scorecard/totals.json may override either list. */
export const DEFAULT_CONFIG = {
  // QuickBooks user names that count as our team. Tom's login is also the one our agents use.
  team: ["Thomas MacDonald"],
  // Our own books, not a client's.
  skipCompanies: ["Bookkeeping Conroe", "Thomas Grant MacDonald"],
};

export function readConfig(file = CONFIG) {
  let raw = {};
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw new Error(`${file}: ${error.message}`);
  }
  const list = (value, fallback) =>
    Array.isArray(value) && value.every((v) => typeof v === "string") ? value : fallback;
  return { team: list(raw.team, DEFAULT_CONFIG.team), skipCompanies: list(raw.skipCompanies, DEFAULT_CONFIG.skipCompanies) };
}

/** Every Data row of a QuickBooks report, however deeply it is sectioned. */
function* dataRows(rows) {
  for (const row of rows ?? []) {
    if (row.type === "Data") yield row;
    if (row.Rows) yield* dataRows(row.Rows.Row);
  }
}

const MONTH = /^(\d{4}-\d{2})-\d{2}/;

/**
 * Monthly counts of transactions our team touched, from a Transaction List report
 * with columns create_by, create_date, last_mod_by, last_mod_date. A transaction
 * counts once: in its create month if a team member entered it, else in its
 * last-modified month if a team member last changed it. Dates keep the
 * company's own offset, so the month is the company's local month.
 */
export function countTeamMonths(report, team) {
  const titles = (report?.Columns?.Column ?? []).map((c) => c.ColTitle);
  const col = (...names) => titles.findIndex((t) => names.includes(t));
  const createdBy = col("Created By");
  const createdAt = col("Create Date");
  const changedBy = col("Last Modified By");
  const changedAt = col("Last Modified", "Last Modified Date");
  if ([createdBy, createdAt, changedBy, changedAt].includes(-1)) {
    throw new Error(`report is missing a column (got ${titles.join(", ")})`);
  }
  const members = new Set(team.map((name) => name.trim().toLowerCase()));
  const isTeam = (value) => members.has(String(value ?? "").trim().toLowerCase());
  const months = new Map();
  let rows = 0;
  for (const row of dataRows(report?.Rows?.Row)) {
    rows += 1;
    const cell = (i) => row.ColData?.[i]?.value;
    const when = isTeam(cell(createdBy)) ? cell(createdAt) : isTeam(cell(changedBy)) ? cell(changedAt) : null;
    const month = when ? MONTH.exec(String(when))?.[1] : null;
    if (month) months.set(month, (months.get(month) ?? 0) + 1);
  }
  return { rows, months };
}

/** Published reports per covered month under root/<client>/reports/<year>/<YYYY-MM>.pdf. */
export function countReportFiles(root) {
  const months = new Map();
  const dirs = (dir) => {
    try {
      return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.isSymbolicLink());
    } catch {
      return [];
    }
  };
  for (const client of dirs(root)) {
    const reports = path.join(root, client.name, "reports");
    for (const year of dirs(reports)) {
      if (!/^\d{4}$/.test(year.name)) continue;
      for (const file of fs.readdirSync(path.join(reports, year.name), { withFileTypes: true })) {
        const match = /^(\d{4})-(0[1-9]|1[0-2])\.pdf$/.exec(file.name);
        if (!file.isFile() || !match || match[1] !== year.name) continue;
        const month = `${match[1]}-${match[2]}`;
        months.set(month, (months.get(month) ?? 0) + 1);
      }
    }
  }
  return months;
}

export function mergeMonths(into, from) {
  for (const [month, value] of from) into.set(month, (into.get(month) ?? 0) + value);
  return into;
}

/** Sorted [{month, value}], dropping months after `lastMonth` (a clock-skewed QuickBooks date). */
export function monthList(months, lastMonth) {
  return [...months]
    .filter(([month]) => month <= lastMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => ({ month, value }));
}

function firmMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit" })
    .formatToParts(now);
  return `${parts.find((p) => p.type === "year").value}-${parts.find((p) => p.type === "month").value}`;
}

function loadOpsEnv(file = OPS_ENV) {
  const env = {};
  try {
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const text = line.trim();
      if (!text || text.startsWith("#") || !text.includes("=")) continue;
      const at = text.indexOf("=");
      env[text.slice(0, at).trim()] = text.slice(at + 1).trim().replace(/^["']|["']$/g, "");
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const token = process.env.SWAPP_OPERATIONS_TOKEN || env.SWAPP_OPERATIONS_TOKEN;
  const base = (process.env.SWAPP_BASE_URL || env.SWAPP_BASE_URL || DEFAULT_BASE).replace(/\/$/, "");
  return { token, base };
}

async function countQuickBooks(config, today) {
  process.env.BOOKBOT_CONFIG_DIR ??= path.join(HOME, ".config/bookbot-prod");
  // bookbot treats the working directory as its project root and refuses a config dir
  // inside it; qb cds into bookbot-app first, and so does this (systemd starts in $HOME).
  process.chdir(BOOKBOT_ROOT);
  const load = (file) => import(pathToFileURL(path.join(BOOKBOT_ROOT, "src", file)).href);
  const { readAllTokens, readAllConnections } = await load("config.ts");
  const { fetchReport, refreshTokens, PROD_API_BASE, PROD_CALLBACK_URL } = await load("qbo.ts");
  const [tokens, connections] = await Promise.all([readAllTokens(), readAllConnections()]);
  const skip = new Set(config.skipCompanies.map((name) => name.trim().toLowerCase()));
  const months = new Map();
  const failures = [];
  let companies = 0;
  for (const [realmId, connection] of Object.entries(connections)) {
    const name = String(connection?.companyName ?? realmId);
    if (skip.has(name.trim().toLowerCase())) continue;
    companies += 1;
    try {
      if (!tokens[realmId]) throw new Error("no saved tokens");
      const fresh = await refreshTokens(tokens[realmId]);
      const report = await fetchReport(
        fresh,
        "TransactionList",
        { start_date: "1990-01-01", end_date: today, columns: "tx_date,create_by,create_date,last_mod_by,last_mod_date" },
        fetch,
        { apiBase: PROD_API_BASE, callbackUrl: PROD_CALLBACK_URL },
      );
      mergeMonths(months, countTeamMonths(report, config.team).months);
    } catch (error) {
      // The company name stays in this machine's log only; SWapp gets a count.
      failures.push(`${name}: ${error?.name ?? "Error"} ${String(error?.message ?? error).slice(0, 120)}`);
    }
  }
  return { months, companies, failures };
}

async function post(base, token, body) {
  const response = await fetch(`${base}/api/scorecard/totals`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`POST /api/scorecard/totals ${body.metric} -> HTTP ${response.status} ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

export async function main(argv = process.argv.slice(2)) {
  const dryRun = argv.includes("--dry-run");
  const onlyAt = argv.indexOf("--only");
  const only = onlyAt >= 0 ? argv[onlyAt + 1] : null;
  if (only && !["transactions", "reports"].includes(only)) {
    console.error("--only must be transactions or reports");
    return 2;
  }
  const { token, base } = loadOpsEnv();
  if (!token && !dryRun) {
    console.error(`SWAPP_OPERATIONS_TOKEN is not set (${OPS_ENV})`);
    return 1;
  }
  const now = new Date();
  const lastMonth = firmMonth(now);
  const today = now.toISOString().slice(0, 10);
  let failed = false;

  if (only !== "transactions") {
    const months = monthList(countReportFiles(REPORTS_ROOT), lastMonth);
    const total = months.reduce((n, m) => n + m.value, 0);
    console.log(`[reports] ${total} reports over ${months.length} months`);
    if (!dryRun) {
      const result = await post(base, token, { brand: BRAND, metric: "reports", months, note: `${total} reports` });
      console.log(`[reports] posted ${result.months} months`);
    }
  }

  if (only !== "reports") {
    const config = readConfig();
    const { months: counted, companies, failures } = await countQuickBooks(config, today);
    const months = monthList(counted, lastMonth);
    const total = months.reduce((n, m) => n + m.value, 0);
    console.log(`[transactions] ${total} over ${months.length} months from ${companies - failures.length} of ${companies} companies`);
    for (const line of failures) console.error(`[transactions] failed ${line}`);
    if (failures.length) {
      // A partial count would replace the full one; keep yesterday's numbers instead.
      console.error("[transactions] not posted: a company failed");
      failed = true;
    } else if (!dryRun) {
      const note = `${total} transactions, ${companies} client books`;
      const result = await post(base, token, { brand: BRAND, metric: "transactions", months, note });
      console.log(`[transactions] posted ${result.months} months`);
    }
  }
  return failed ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      console.error(error?.message ?? error);
      process.exit(1);
    },
  );
}
