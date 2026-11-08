// Mirror QuickBooks invoice history into CustomerArSnapshot.
// Reads `qb invoices --json` (BookBot owns OAuth and the read-only QBO API),
// then stores each invoice, its current balance, and its applied payments.
// This script never changes QuickBooks.
// Usage: dotenv -e .env -- node scripts/sync-ar-snapshot.mjs
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

function parseDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function invoiceStatus(invoice) {
  if (invoice.txnStatus?.toLowerCase() === "voided") return "VOIDED";
  const total = Number(invoice.totalAmount) || 0;
  const balance = Number(invoice.balance) || 0;
  if (balance <= 0) return invoice.payments?.length ? "PAID" : "ZERO_BALANCE";
  if (total > balance) return "PARTIAL";
  return "OPEN";
}

async function fetchInvoices(company) {
  const { stdout } = await execFileAsync(
    QB_BIN,
    ["invoices", "--company", company, "--json"],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  const payload = JSON.parse(stdout);
  if (payload.source !== "live" || payload.companyName?.toLowerCase() !== "bookkeeping conroe") {
    throw new Error(`Expected a live Bookkeeping Conroe invoice response; got ${payload.companyName ?? "unknown company"} (${payload.source ?? "unknown source"})`);
  }
  if (!Array.isArray(payload.invoices) || payload.count !== payload.invoices.length) {
    throw new Error("QuickBooks invoice response is incomplete; existing snapshot was left untouched");
  }
  if (!payload.invoices.length) {
    throw new Error("QuickBooks returned no invoice history; existing snapshot was left untouched");
  }
  return payload.invoices;
}

const prisma = new PrismaClient();
try {
  const runStart = new Date();
  for (const [company, brandSlug] of Object.entries(COMPANY_BRANDS)) {
    const brand = await prisma.brand.findUnique({ where: { slug: brandSlug }, select: { id: true } });
    if (!brand) throw new Error(`brand not found: ${brandSlug}`);
    const invoices = await fetchInvoices(company);
    let created = 0;
    let updated = 0;
    const docNumberCounts = new Map();
    for (const invoice of invoices) {
      const name = String(invoice.customerName ?? "").trim();
      const number = String(invoice.docNumber ?? "").trim();
      if (!name || !number) continue;
      const key = JSON.stringify([name, number]);
      docNumberCounts.set(key, (docNumberCounts.get(key) ?? 0) + 1);
    }

    for (const invoice of invoices) {
      const qboInvoiceId = String(invoice.id ?? "");
      const customerName = String(invoice.customerName ?? "").trim();
      if (!qboInvoiceId || !customerName) continue;
      const qboDocNumber = String(invoice.docNumber ?? "").trim() || null;
      const duplicateNumber = qboDocNumber && (docNumberCounts.get(JSON.stringify([customerName, qboDocNumber])) ?? 0) > 1;
      const invoiceRef = qboDocNumber
        ? duplicateNumber ? `${qboDocNumber}#${qboInvoiceId}` : qboDocNumber
        : `QBO-${qboInvoiceId}`;
      const data = {
        qboCustomerId: String(invoice.customerId ?? "") || null,
        customerName,
        invoiceRef,
        qboDocNumber,
        txnDate: parseDate(invoice.txnDate),
        dueDate: parseDate(invoice.dueDate),
        totalAmount: (Number(invoice.totalAmount) || 0).toFixed(2),
        openBalance: (Number(invoice.balance) || 0).toFixed(2),
        status: invoiceStatus(invoice),
        emailStatus: invoice.emailStatus ?? null,
        paymentHistory: Array.isArray(invoice.payments) ? invoice.payments : [],
        syncedAt: runStart,
      };
      const existingByQboId = await prisma.customerArSnapshot.findUnique({
        where: { brandId_qbCompany_qboInvoiceId: { brandId: brand.id, qbCompany: company, qboInvoiceId } },
        select: { id: true },
      });
      if (existingByQboId) {
        await prisma.customerArSnapshot.update({ where: { id: existingByQboId.id }, data });
        updated += 1;
        continue;
      }
      const legacy = qboDocNumber
        ? await prisma.customerArSnapshot.findUnique({
            where: { brandId_qbCompany_customerName_invoiceRef: { brandId: brand.id, qbCompany: company, customerName, invoiceRef: qboDocNumber } },
            select: { id: true, qboInvoiceId: true },
          })
        : null;
      if (legacy && !legacy.qboInvoiceId) {
        await prisma.customerArSnapshot.update({ where: { id: legacy.id }, data: { ...data, qboInvoiceId } });
        updated += 1;
        continue;
      }
      if (legacy && legacy.qboInvoiceId !== qboInvoiceId && !duplicateNumber) {
        throw new Error(`Conflicting QuickBooks invoice link for ${qboDocNumber}; existing customer mapping was left untouched`);
      }
      await prisma.customerArSnapshot.create({
        data: { brandId: brand.id, qbCompany: company, qboInvoiceId, ...data },
      });
      created += 1;
    }

    const stale = await prisma.customerArSnapshot.deleteMany({
      where: { brandId: brand.id, qbCompany: company, syncedAt: { lt: runStart } },
    });
    console.log(`${company}: ${invoices.length} invoices (${created} added, ${updated} updated), ${stale.count} stale rows removed`);
  }
} catch (error) {
  console.error(`invoice-history-sync failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
