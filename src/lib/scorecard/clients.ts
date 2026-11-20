/**
 * Who counts as a client for the Scorecard (docs/scorecard.md § What is
 * measured): a Contact with at least one ServiceRecord. The collector fetches
 * this list and keeps only events from these numbers and addresses, inside
 * each client's clientFrom..clientUntil.
 */
import { prisma } from "@/lib/prisma";
import type { ScorecardClient } from "./types";

/** E.164 for US numbers (10 digits, or 11 starting with 1); null otherwise. */
export function phoneE164(value: string | null | undefined): string | null {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export type ClientRecordRow = {
  contactId: string;
  startDate: Date;
  endDate: Date | null;
  evidenceDate: Date;
  contact: {
    name: string;
    phoneE164: string | null;
    phoneNumber: string | null;
    email: string | null;
    secondaryEmail: string | null;
    businessEmail: string | null;
    personalEmail: string | null;
  };
};

/** Date columns come back as UTC midnight of the stored day. */
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

const unique = (values: (string | null)[]) => [...new Set(values.filter((v): v is string => !!v))];

/** One row per contact from its service records, sorted by name. */
export function buildScorecardClients(rows: ClientRecordRow[]): ScorecardClient[] {
  const byContact = new Map<string, ClientRecordRow[]>();
  for (const row of rows) {
    const list = byContact.get(row.contactId) ?? [];
    list.push(row);
    byContact.set(row.contactId, list);
  }
  const out: ScorecardClient[] = [];
  for (const [contactId, records] of byContact) {
    const contact = records[0].contact;
    const starts = records.flatMap((r) => [dayKey(r.startDate), dayKey(r.evidenceDate)]).sort();
    const allEnded = records.every((r) => r.endDate !== null);
    const ends = records.flatMap((r) => (r.endDate ? [dayKey(r.endDate)] : [])).sort();
    out.push({
      contactId,
      name: contact.name,
      phones: unique([phoneE164(contact.phoneE164), phoneE164(contact.phoneNumber)]),
      emails: unique(
        [contact.email, contact.secondaryEmail, contact.businessEmail, contact.personalEmail].map(
          (e) => e?.trim().toLowerCase() || null,
        ),
      ),
      clientFrom: starts[0],
      clientUntil: allEnded ? ends[ends.length - 1] : null,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name) || a.contactId.localeCompare(b.contactId));
}

/** Every client of a brand, with the numbers and addresses to match on. */
export async function listScorecardClients(brandId: string): Promise<ScorecardClient[]> {
  const rows = await prisma.serviceRecord.findMany({
    where: { brandId },
    select: {
      contactId: true,
      startDate: true,
      endDate: true,
      evidenceDate: true,
      contact: {
        select: {
          name: true,
          phoneE164: true,
          phoneNumber: true,
          email: true,
          secondaryEmail: true,
          businessEmail: true,
          personalEmail: true,
        },
      },
    },
  });
  return buildScorecardClients(rows);
}
