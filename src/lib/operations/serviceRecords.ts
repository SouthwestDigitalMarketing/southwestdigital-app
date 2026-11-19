/**
 * Service records (All Thing concepts/service-records-design): one row per
 * paid service a client has. The database enforces the same rules with CHECK
 * constraints (migration 20261118233000_service_records); this module gives
 * callers a readable error first, and answers "active on a day".
 */

export const SERVICE_BASES = ["monthly", "one_time", "hourly"] as const;
export const SERVICE_END_REASONS = [
  "job_done",
  "client_cancelled",
  "terminated_by_us",
  "agreement_ended",
  "replaced",
  "lapsed",
] as const;
export const SERVICE_EVIDENCE_SOURCES = ["swapp_proposal", "qbo_contract", "agreement_file", "paid_invoice"] as const;

export type ServiceBasis = (typeof SERVICE_BASES)[number];
export type ServiceEndReason = (typeof SERVICE_END_REASONS)[number];
export type ServiceEvidenceSource = (typeof SERVICE_EVIDENCE_SOURCES)[number];

export type ServiceRecordInput = {
  /** Caller's id for this record; a repeat upsert with it updates the same row. */
  sourceKey: string;
  contactId: string;
  engagementId: string | null;
  product: string;
  basis: ServiceBasis;
  feeAmount: number | null;
  startDate: string;
  endDate: string | null;
  endReason: ServiceEndReason | null;
  evidenceSource: ServiceEvidenceSource;
  evidenceRef: string;
  evidenceDate: string;
  notes: string | null;
  /** sourceKey of the record this one replaces (fee change by amendment). */
  previousSourceKey: string | null;
};

const clean = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const KEY = /^[a-z0-9][a-z0-9-]{0,79}$/;
const SOURCE_KEY = /^[a-z0-9][a-z0-9:._-]{0,199}$/;

const isDate = (value: string) => DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

/** Validates one record. Returns an error message or the input. */
export function parseServiceRecord(raw: Record<string, unknown>): ServiceRecordInput | string {
  const sourceKey = clean(raw.sourceKey, 200);
  if (!SOURCE_KEY.test(sourceKey)) return "sourceKey is required: lowercase letters, digits and : . _ -";
  const contactId = clean(raw.contactId, 64);
  if (!contactId) return "contactId is required";
  const product = clean(raw.product, 80);
  if (!KEY.test(product)) return "product must be a service key, e.g. monthly-bookkeeping";
  const basis = clean(raw.basis, 20) as ServiceBasis;
  if (!SERVICE_BASES.includes(basis)) return `basis must be one of: ${SERVICE_BASES.join(", ")}`;

  let feeAmount: number | null = null;
  if (raw.feeAmount !== undefined && raw.feeAmount !== null && raw.feeAmount !== "") {
    feeAmount = Number(raw.feeAmount);
    if (!Number.isFinite(feeAmount) || feeAmount < 0) return "feeAmount must be a number, 0 or more";
  }

  const evidenceSource = clean(raw.evidenceSource, 30) as ServiceEvidenceSource;
  if (!SERVICE_EVIDENCE_SOURCES.includes(evidenceSource)) {
    return `evidenceSource must be one of: ${SERVICE_EVIDENCE_SOURCES.join(", ")}`;
  }
  const evidenceRef = clean(raw.evidenceRef, 500);
  if (!evidenceRef) return "evidenceRef is required: engagement id, contract name, file path or invoice number";
  const evidenceDate = clean(raw.evidenceDate, 10);
  if (!isDate(evidenceDate)) return "evidenceDate must be YYYY-MM-DD (day signed, or invoice paid)";

  if (basis === "monthly") {
    if (feeAmount === null || feeAmount <= 0) return "a monthly record needs its agreed monthly fee";
    if (evidenceSource === "paid_invoice") return "a monthly record opens only from a signed agreement, not an invoice";
  }

  const startDate = clean(raw.startDate, 10);
  if (!isDate(startDate)) return "startDate must be YYYY-MM-DD";
  const endDate = clean(raw.endDate, 10) || null;
  if (endDate && !isDate(endDate)) return "endDate must be YYYY-MM-DD";
  if (endDate && endDate < startDate) return "endDate is before startDate";
  const endReason = (clean(raw.endReason, 30) || null) as ServiceEndReason | null;
  if (endReason && !SERVICE_END_REASONS.includes(endReason)) {
    return `endReason must be one of: ${SERVICE_END_REASONS.join(", ")}`;
  }
  if (Boolean(endDate) !== Boolean(endReason)) return "endDate and endReason go together";

  const previousSourceKey = clean(raw.previousSourceKey, 200) || null;
  if (previousSourceKey === sourceKey) return "a record cannot replace itself";

  return {
    sourceKey,
    contactId,
    engagementId: clean(raw.engagementId, 64) || null,
    product,
    basis,
    feeAmount,
    startDate,
    endDate,
    endReason,
    evidenceSource,
    evidenceRef,
    evidenceDate,
    notes: clean(raw.notes, 2000) || null,
    previousSourceKey,
  };
}

type Dated = { startDate: string; endDate: string | null };

/** Started on or before `day` and not ended before it (endDate is the last day of service). */
export function isActiveOn(record: Dated, day: string): boolean {
  return record.startDate <= day && (record.endDate === null || record.endDate >= day);
}

/** Agreed monthly fees of monthly records active on `day`, and the clients they cover. */
export function monthlyRecurringRevenue(
  records: (Dated & { basis: string; feeAmount: number | null; contactId: string })[],
  day: string,
): { total: number; clients: number } {
  const active = records.filter((r) => r.basis === "monthly" && isActiveOn(r, day));
  return {
    total: active.reduce((sum, r) => sum + (r.feeAmount ?? 0), 0),
    clients: new Set(active.map((r) => r.contactId)).size,
  };
}
