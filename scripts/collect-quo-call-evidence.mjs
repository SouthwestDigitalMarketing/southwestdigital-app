#!/usr/bin/env node
// Read Quo's already synced call cache. Never change Sales SQLite or infer a stage.
import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const apply = process.argv.includes("--apply");
const verbose = process.argv.includes("--verbose");
const daysArg = process.argv.find((arg) => arg.startsWith("--days="));
const days = daysArg ? Number(daysArg.slice(7)) : 1;
if (!Number.isInteger(days) || days < 1 || days > 30) throw new Error("--days must be 1 through 30");
const since = new Date(Date.now() - days * 86_400_000).toISOString();
const dbPath = process.env.SALES_DB_PATH || join(homedir(), ".local/share/lochside-sales/sales.db");
const sql = `SELECT call_number, provider_id, phone, phone_number_id, line_number, participants, direction, status, duration, created_at, completed_at
  FROM calls WHERE provider = 'quo' AND status = 'completed' AND created_at >= '${since}'
  ORDER BY created_at ASC`;
const calls = JSON.parse(execFileSync("sqlite3", ["-readonly", "-json", dbPath, sql], { encoding: "utf8" }) || "[]");
const prisma = new PrismaClient();
const phone = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
};
const safeDate = (value) => {
  const date = new Date(value || "");
  return Number.isFinite(date.getTime()) ? date : null;
};

try {
  const integrations = await prisma.brandIntegration.findMany({
    where: { key: "quo", provider: "QUO", status: "ACTIVE" },
    select: { brandId: true, publicIdentifier: true, externalAccountId: true, externalPropertyId: true, brand: { select: { slug: true } } },
  });
  const counts = { scanned: calls.length, matched: 0, alreadyRecorded: 0, ambiguous: 0, unmatched: 0, invalid: 0 };
  for (const call of calls) {
    if (!call.provider_id || !safeDate(call.completed_at || call.created_at)) { counts.invalid++; continue; }
    const line = integrations.filter((entry) =>
      (call.phone_number_id && entry.externalPropertyId === call.phone_number_id) ||
      (phone(entry.publicIdentifier || entry.externalAccountId) === phone(call.line_number) && phone(call.line_number)),
    );
    if (line.length !== 1) { counts.ambiguous++; continue; }
    const brand = line[0];
    const participants = (() => { try { return JSON.parse(call.participants || "[]"); } catch { return []; } })();
    const people = new Set([call.phone, ...participants].map(phone).filter((value) => value && value !== phone(call.line_number)));
    if (people.size !== 1) { counts.ambiguous++; continue; }
    const number = [...people][0];
    const possibleContacts = await prisma.contact.findMany({
      where: { brandId: brand.brandId, isActive: true, OR: [{ phoneE164: { not: null } }, { phoneNumber: { not: null } }] },
      select: { id: true, name: true, phoneE164: true, phoneNumber: true, leadLinks: { select: { lead: { select: { id: true, isActive: true } } } } },
    });
    const contacts = possibleContacts.filter((contact) => phone(contact.phoneE164) === number || phone(contact.phoneNumber) === number);
    const leadIds = [...new Set(contacts.flatMap((contact) => contact.leadLinks.filter((link) => link.lead.isActive).map((link) => link.lead.id)))];
    if (leadIds.length === 0) { counts.unmatched++; continue; }
    if (leadIds.length !== 1) { counts.ambiguous++; continue; }
    const existing = await prisma.salesEvidenceEvent.findUnique({
      where: { brandId_source_sourceEventId: { brandId: brand.brandId, source: "quo", sourceEventId: call.provider_id } },
      select: { id: true, leadId: true },
    });
    if (existing) {
      if (existing.leadId !== leadIds[0]) counts.ambiguous++;
      else counts.alreadyRecorded++;
      continue;
    }
    counts.matched++;
    if (verbose) console.log(JSON.stringify({ callNumber: call.call_number, callId: call.provider_id, leadId: leadIds[0], leadName: contacts[0].name, brand: brand.brand.slug }));
    if (!apply) continue;
    const summary = `Completed ${call.direction === "incoming" ? "incoming" : call.direction === "outgoing" ? "outgoing" : ""} Quo call with ${contacts[0].name}${Number.isFinite(call.duration) && call.duration > 0 ? ` (${call.duration} seconds)` : ""}.`.replace(/\s+/g, " ");
    await prisma.$transaction(async (tx) => {
      const event = await tx.salesEvidenceEvent.upsert({
        where: { brandId_source_sourceEventId: { brandId: brand.brandId, source: "quo", sourceEventId: call.provider_id } },
        update: {},
        create: {
          brandId: brand.brandId, leadId: leadIds[0], source: "quo", sourceEventId: call.provider_id,
          eventType: "call_completed", occurredAt: safeDate(call.completed_at || call.created_at),
          summary, sourceRef: `Quo call #${call.call_number} (${call.provider_id})`,
        },
        select: { id: true },
      });
      await tx.allThingWriteJob.upsert({ where: { eventId: event.id }, update: {}, create: { eventId: event.id } });
    });
  }
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", since, counts }));
} finally { await prisma.$disconnect(); }
