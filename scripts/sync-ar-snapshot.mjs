// Mirror QuickBooks A/R aging rows into CustomerArSnapshot.
//
// Reads `qb report ar-aging-detail --json` (the qb CLI owns QuickBooks OAuth,
// refresh, and caching) and upserts one row per open invoice. Past-due means
// the invoice's own terms say so: due date passed, balance still open.
//
// Usage: dotenv -e .env -- node scripts/sync-ar-snapshot.mjs
// Staged systemd unit: docs/sync-ar-snapshot.service (enable on say-so).
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config({ path: new URL("../.env", import.meta.url) });

const execFileAsync = promisify(execFile);

// QuickBooks company slug -> SWapp brand slug. One firm books today.
const COMPANY_BRANDS = {
  "bookkeeping-conroe": "bookkeeping-conroe",
};

const QB_BIN = process.env.QB_BIN ?? "qb";

function parseMoney(value) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDueDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

// ColData cells line up with Columns by position.
function rowByName(row, columns) {
  const out = {};
  for (const [index, cell] of (row.ColData ?? []).entries()) {
    if (columns[index]) out[columns[index]] = cell.value ?? null;
  }
  return out;
}

function columnNames(report) {
  return (report?.Columns?.Column ?? []).map((c) => c.ColTitle);
}

function collectRows(rows, out) {
  for (const row of rows ?? []) {
    if (row.ColData) out.push(row);
    collectRows(row.Rows?.Row, out);
  }
  return out;
}

async function fetchAging(company) {
  const { stdout } = await execFileAsync(
    QB_BIN,
    ["report", "ar-aging-detail", "-c", company, "--json", "-p", "this-month"],
    { maxBuffer: 32 * 1024 * 1024 },
  );
  return JSON.parse(stdout);
}

const prisma = new PrismaClient();

let added = 0;
let updated = 0;
try {
  const runStart = new Date();
  for (const [company, brandSlug] of Object.entries(COMPANY_BRANDS)) {
    const brand = await prisma.brand.findUnique({ where: { slug: brandSlug }, select: { id: true } });
    if (!brand) throw new Error(`brand not found: ${brandSlug}`);
    const payload = await fetchAging(company);
    const columns = columnNames(payload.data);
    const required = ["Num", "Client", "Due Date", "Open Balance"];
    for (const name of required) {
      if (!columns.includes(name)) throw new Error(`A/R columns changed, missing ${name}`);
    }
    const rows = collectRows(payload.data?.Rows?.Row, []);
    let kept = 0;
    for (const row of rows) {
      const named = rowByName(row, columns);
      const num = named["Num"];
      const client = named["Client"];
      const due = named["Due Date"];
      const open = named["Open Balance"];
      if (!client) continue;
      const openBalance = parseMoney(open);
      if (!(openBalance > 0)) continue;
      const dueDate = parseDueDate(due);
      const key = {
        brandId: brand.id,
        qbCompany: company,
        customerName: String(client),
        invoiceRef: num ? String(num) : null,
      };
      const existing = await prisma.customerArSnapshot.findUnique({ where: { brandId_qbCompany_customerName_invoiceRef: key } });
      await prisma.customerArSnapshot.upsert({
        where: { brandId_qbCompany_customerName_invoiceRef: key },
        create: { ...key, dueDate, openBalance: openBalance.toFixed(2), syncedAt: runStart },
        update: { dueDate, openBalance: openBalance.toFixed(2), syncedAt: runStart },
      });
      if (existing) updated += 1;
      else added += 1;
      kept += 1;
    }
    const stale = await prisma.customerArSnapshot.deleteMany({
      where: { brandId: brand.id, qbCompany: company, syncedAt: { lt: runStart } },
    });
    console.log(`${company}: ${kept} open invoices (${added} added, ${updated} updated), ${stale.count} stale removed`);
  }
} catch (error) {
  console.error(`ar-snapshot failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
