#!/usr/bin/env node
// Read-only QBO reports for Lochside's own books. Requires a human-confirmed
// closed month and exact account names in ~/.config/swapp/company-cash-flow.json.
// Never posts a guessed tax reserve or an open month's figures.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const configPath = process.env.COMPANY_CASH_FLOW_CONFIG ?? path.join(os.homedir(), ".config/swapp/company-cash-flow.json");
const envPath = process.env.SWAPP_OPERATIONS_ENV ?? path.join(os.homedir(), ".config/swapp/operations.env");
const monthEnd = (month) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
const parseAmount = (value) => { const n = Number(String(value ?? "").replaceAll(",", "")); if (!Number.isFinite(n)) throw new Error("QBO report amount is missing"); return n; };

export function profitLossTotals(report) {
  const rows = report?.Rows?.Row ?? [];
  const income = rows.filter((row) => ["Income", "Other Income"].includes(row.Header?.ColData?.[0]?.value)).reduce((sum, row) => sum + parseAmount(row.Summary?.ColData?.[1]?.value), 0);
  const net = rows.findLast((row) => row.Summary?.ColData?.[0]?.value === "Net Income");
  if (!net || !rows.some((row) => row.Header?.ColData?.[0]?.value === "Income")) throw new Error("QBO P&L lacks Income or Net Income summary");
  return { incomeUsd: income, expensesUsd: Math.round((income - parseAmount(net.Summary.ColData[1]?.value)) * 100) / 100 };
}

export function accountTotal(report, name) {
  const matches = (report?.Rows?.Row ?? []).filter((row) => row.Header?.ColData?.[0]?.value === name);
  if (matches.length !== 1) throw new Error(`QBO account ${JSON.stringify(name)} found ${matches.length} times`);
  const cells = matches[0].Summary?.ColData ?? [];
  const value = cells.findLast((cell) => cell?.value && /^-?[\d,.]+$/.test(cell.value));
  if (!value) throw new Error(`QBO account ${JSON.stringify(name)} has no total`);
  return parseAmount(value.value);
}

function opsEnv() {
  const raw = fs.readFileSync(envPath, "utf8");
  const data = Object.fromEntries(raw.split("\n").filter((line) => /^[A-Z_]+=.*/.test(line)).map((line) => { const at = line.indexOf("="); return [line.slice(0, at), line.slice(at + 1).replace(/^["']|["']$/g, "")]; }));
  return { token: process.env.SWAPP_OPERATIONS_TOKEN ?? data.SWAPP_OPERATIONS_TOKEN, base: process.env.SWAPP_BASE_URL ?? data.SWAPP_BASE_URL ?? "https://admin.southwestdigital.io" };
}

export async function main(argv = process.argv.slice(2)) {
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const month = config.closedThroughMonth;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month ?? "") || !config.closedAt || !config.ownerDrawAccount || !config.taxSetAsideAccount) throw new Error("Set closedThroughMonth, closedAt, ownerDrawAccount and taxSetAsideAccount in config after verifying QBO");
  const start = `${month}-01`, end = monthEnd(month);
  if (end >= new Date().toISOString().slice(0, 10)) throw new Error("Month is not over");
  const report = (kind, basis) => JSON.parse(execFileSync("qb", ["report", kind, "-c", "bookkeeping-conroe", "-p", `${start}..${end}`, "-b", basis, "--json"], { encoding: "utf8", maxBuffer: 20_000_000 })).data;
  const pl = profitLossTotals(report("profit-loss", "cash"));
  const ledger = report("general-ledger", "cash");
  const ownerDrawUsd = accountTotal(ledger, config.ownerDrawAccount);
  const taxSetAsideUsd = accountTotal(ledger, config.taxSetAsideAccount);
  const values = [pl.incomeUsd, pl.expensesUsd, ownerDrawUsd, taxSetAsideUsd];
  if (values.some((value) => value < 0)) throw new Error("Negative component needs human review; no snapshot posted");
  const body = { month, ...pl, ownerDrawUsd, taxSetAsideUsd, closedAt: config.closedAt, sourceAccounts: { ownerDraw: config.ownerDrawAccount, taxSetAside: config.taxSetAsideAccount } };
  if (argv.includes("--dry-run")) { process.stdout.write(JSON.stringify({ ...body, freeCashFlowUsd: pl.incomeUsd - pl.expensesUsd - ownerDrawUsd - taxSetAsideUsd }) + "\n"); return; }
  const { token, base } = opsEnv();
  if (!token) throw new Error("SWAPP_OPERATIONS_TOKEN missing");
  const result = await fetch(`${base.replace(/\/$/, "")}/api/company-metrics/cash-flow`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(60_000) });
  if (!result.ok) throw new Error(`Cash flow POST HTTP ${result.status}: ${(await result.text()).slice(0, 200)}`);
  process.stdout.write(JSON.stringify(await result.json()) + "\n");
}

if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
