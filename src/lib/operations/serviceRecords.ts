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

export type ClientMrr = { id: string; name: string; company: string | null; mrr: number };
export type StartingMrr = ClientMrr & { startDate: string };

/**
 * Per-client MRR on `day` from monthly records, biggest first, and the
 * monthly records signed but not started yet ("signed, starting"), soonest
 * first. A future record of a client already counted still shows as starting.
 */
export function clientMrrOn(
  records: (Dated & { basis: string; feeAmount: number | null; contactId: string; contactName: string; company: string | null })[],
  day: string,
): { clients: ClientMrr[]; starting: StartingMrr[] } {
  const byClient = new Map<string, ClientMrr>();
  const starting: StartingMrr[] = [];
  for (const r of records) {
    if (r.basis !== "monthly") continue;
    const fee = r.feeAmount ?? 0;
    if (isActiveOn(r, day)) {
      const seen = byClient.get(r.contactId) ?? { id: r.contactId, name: r.contactName, company: r.company, mrr: 0 };
      seen.mrr += fee;
      byClient.set(r.contactId, seen);
    } else if (r.startDate > day) {
      starting.push({ id: r.contactId, name: r.contactName, company: r.company, mrr: fee, startDate: r.startDate });
    }
  }
  return {
    clients: [...byClient.values()].sort((a, b) => b.mrr - a.mrr || a.name.localeCompare(b.name)),
    starting: starting.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name)),
  };
}

const SERVICE_TAG = /^service-([a-z0-9][a-z0-9-]*)-(active|ended)$/;

/**
 * Tags a contact should carry from its service records on `day`
 * (concepts/client-lifecycle-tags § Service status): `service-<product>-active`
 * while a record of that product is active, `-ended` once every record of it
 * has ended (a record that has not started yet changes neither); then
 * `active-client` if any service is active, `former-client` if services exist
 * but none is active or starting. Service tags for products with no records
 * (set by hand before records existed) are left alone and still count as
 * active. Returns only the changes.
 */
export function serviceTagPlan(
  records: (Dated & { product: string })[],
  tags: string[],
  day: string,
): { add: string[]; remove: string[] } {
  const want = new Set(tags);
  const products = new Set(records.map((r) => r.product));
  let anyStarting = false;
  for (const product of products) {
    const mine = records.filter((r) => r.product === product);
    if (mine.some((r) => isActiveOn(r, day))) {
      want.add(`service-${product}-active`);
      want.delete(`service-${product}-ended`);
    } else if (mine.some((r) => r.startDate > day)) {
      anyStarting = true;
    } else {
      want.add(`service-${product}-ended`);
      want.delete(`service-${product}-active`);
    }
  }
  const anyActive = [...want].some((t) => SERVICE_TAG.exec(t)?.[2] === "active");
  if (anyActive) {
    want.add("active-client");
    want.delete("former-client");
  } else if (products.size > 0 && !anyStarting) {
    want.add("former-client");
    want.delete("active-client");
  }
  const had = new Set(tags);
  return {
    add: [...want].filter((t) => !had.has(t)).sort(),
    remove: [...had].filter((t) => !want.has(t)).sort(),
  };
}

/** Product of a `service-<product>-active` tag, or null. */
export function activeServiceProduct(tag: string): string | null {
  const m = SERVICE_TAG.exec(tag);
  return m && m[2] === "active" ? m[1] : null;
}

export type MrrMismatch = { id: string; name: string; problem: string };

/**
 * Tom's rule (2026-11-18): the tag decides who counts, the record gives the
 * fee. A client counts when it carries `service-<product>-active` for a
 * recurring product (a product sold monthly in any record, so no product
 * name is hard-coded). Where tags and records disagree the client is listed
 * as a mismatch: counted at $0 when tagged with no active record, left out
 * when it has an active record but no tag.
 */
export function tagDrivenMrr(input: {
  records: (Parameters<typeof clientMrrOn>[0][number] & { product: string })[];
  /** Contacts with their tag keys (only those carrying some service tag are needed). */
  tagged: { id: string; name: string; company: string | null; tags: string[] }[];
  day: string;
}): { clients: ClientMrr[]; starting: StartingMrr[]; mismatches: MrrMismatch[] } {
  const recurring = new Set(input.records.filter((r) => r.basis === "monthly").map((r) => r.product));
  const fromRecords = clientMrrOn(input.records, input.day);
  const feeById = new Map(fromRecords.clients.map((c) => [c.id, c]));
  const counted = input.tagged.filter((c) =>
    c.tags.some((t) => {
      const product = activeServiceProduct(t);
      return product !== null && recurring.has(product);
    }),
  );
  const countedIds = new Set(counted.map((c) => c.id));
  const mismatches: MrrMismatch[] = [];
  const clients = counted.map((c) => {
    const fee = feeById.get(c.id)?.mrr ?? 0;
    if (!feeById.has(c.id)) mismatches.push({ id: c.id, name: c.name, problem: "Recurring service tag but no active monthly record" });
    return { id: c.id, name: c.name, company: c.company, mrr: fee };
  });
  for (const c of fromRecords.clients) {
    if (!countedIds.has(c.id)) mismatches.push({ id: c.id, name: c.name, problem: "Active monthly record but no service tag" });
  }
  return {
    clients: clients.sort((a, b) => b.mrr - a.mrr || a.name.localeCompare(b.name)),
    starting: fromRecords.starting,
    mismatches,
  };
}
