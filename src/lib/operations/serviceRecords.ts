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
  /** contactId, or contactEmail to find the contact (as client-won does). */
  contactId: string;
  contactEmail: string | null;
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

// Round-trip check: Date quietly rolls 2026-02-29 over to March 1.
const isDate = (value: string) => {
  if (!DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

/** Validates one record. Returns an error message or the input. */
export function parseServiceRecord(raw: Record<string, unknown>): ServiceRecordInput | string {
  const sourceKey = clean(raw.sourceKey, 200);
  if (!SOURCE_KEY.test(sourceKey)) return "sourceKey is required: lowercase letters, digits and : . _ -";
  const contactId = clean(raw.contactId, 64);
  const contactEmail = clean(raw.contactEmail, 200).toLowerCase() || null;
  if (!contactId && !contactEmail) return "contactId or contactEmail is required";
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
    contactEmail,
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

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** "November 1, 2026" or "2026-11-01" -> "2026-11-01", else null. */
export function isoDay(value: unknown): string | null {
  const text = clean(value, 40);
  if (isDate(text)) return text;
  const m = /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/.exec(text);
  const month = m ? MONTHS.indexOf(m[1].toLowerCase()) : -1;
  if (!m || month < 0) return null;
  const day = `${m[3]}-${String(month + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return isDate(day) ? day : null;
}

const money = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Records a paid SWapp proposal opens (service-records-design § How records get
 * filled, first row). Monthly starts on the first of the paid month when the
 * first month was prepaid, else on the pay day; one-time services open on the
 * pay day and end when the work is done.
 */
export function recordsFromProposal(
  selection: Record<string, unknown>,
  meta: { engagementId: string; contactId: string; paidDay: string; signedDay: string | null },
): ServiceRecordInput[] {
  const base = {
    contactId: meta.contactId,
    contactEmail: null,
    engagementId: meta.engagementId,
    endDate: null,
    endReason: null,
    evidenceSource: "swapp_proposal" as const,
    evidenceRef: `engagement ${meta.engagementId}`,
    evidenceDate: meta.signedDay ?? meta.paidDay,
    notes: null,
    previousSourceKey: null,
  };
  const key = (product: string) => `client-won:${meta.engagementId}:${product}`;
  const out: ServiceRecordInput[] = [];
  const monthly = money(selection.recurringMonthlyTotal);
  if (monthly) {
    const start = money(selection.prepaidMonths) ? `${meta.paidDay.slice(0, 7)}-01` : meta.paidDay;
    const tier = clean(selection.selectedTierLabel ?? selection.tierLabel, 80);
    out.push({ ...base, sourceKey: key("monthly-bookkeeping"), product: "monthly-bookkeeping", basis: "monthly", feeAmount: monthly, startDate: start, notes: tier ? `${tier} plan` : null });
  }
  const oneTime: [string, unknown][] = [
    ["onboarding", selection.onboardingFee],
    ["catch-up-bookkeeping", selection.cleanupTotal],
    ["proposal-add-ons", selection.additionalOneTimeTotal],
  ];
  for (const [product, amount] of oneTime) {
    if (money(amount)) {
      out.push({ ...base, sourceKey: key(product), product, basis: "one_time", feeAmount: money(amount), startDate: meta.paidDay });
    }
  }
  return out;
}

/**
 * Records a signed agreement opens, from the JSON the agreement builder wrote
 * (Sales contracts/render.py: ~/projects/clients/_leads/<slug>/agreements/vN/<slug>.json).
 * fees.monthly is the monthly service from start_date; every other numeric fee
 * is a one-time service of that name from the effective date.
 */
export function recordsFromAgreement(
  agreement: Record<string, unknown>,
  meta: { evidenceRef: string; evidenceDate: string | null },
): ServiceRecordInput[] | string {
  const parties = (agreement.parties ?? {}) as Record<string, unknown>;
  const email = clean(parties.client_email ?? parties.notice_email, 200).toLowerCase();
  if (!email) return "agreement has no parties.client_email";
  const effective = isoDay(agreement.effective_date_iso);
  if (!effective) return "agreement has no effective_date_iso";
  const fees = (agreement.fees ?? {}) as Record<string, unknown>;
  const slug = clean(agreement.file_slug, 120).toLowerCase().replace(/[^a-z0-9-]+/g, "-") || "agreement";
  const base = {
    contactId: "",
    contactEmail: email,
    engagementId: null,
    endDate: null,
    endReason: null,
    evidenceSource: "agreement_file" as const,
    evidenceRef: meta.evidenceRef,
    evidenceDate: meta.evidenceDate ?? effective,
    notes: clean(agreement.plan, 80) ? `${clean(agreement.plan, 80)} plan` : null,
    previousSourceKey: null,
  };
  const key = (product: string) => `agreement:${slug}:${effective}:${product}`;
  const out: ServiceRecordInput[] = [];
  if (money(fees.monthly)) {
    const start = isoDay(agreement.start_date);
    if (!start) return "agreement has a monthly fee but no readable start_date";
    out.push({ ...base, sourceKey: key("monthly-bookkeeping"), product: "monthly-bookkeeping", basis: "monthly", feeAmount: money(fees.monthly), startDate: start });
  }
  for (const [name, amount] of Object.entries(fees)) {
    if (name === "monthly" || !money(amount)) continue;
    const product = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!KEY.test(product)) continue;
    out.push({ ...base, sourceKey: key(product), product, basis: "one_time", feeAmount: money(amount), startDate: effective, notes: null });
  }
  return out.length ? out : "agreement has no fees";
}

/** Who fixes a check item: Tom only for real gaps (no agreement on file). */
export type CheckOwner = "tom" | "sol" | "kassad" | "agent";
export type CheckItem = {
  kind: string;
  owner: CheckOwner;
  contactId: string | null;
  name: string;
  detail: string;
  fixed?: boolean;
};

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/**
 * Billing vs records for one month (service-records-design § Mismatch check).
 * Expected for a client = its monthly fees active in the month plus one-time
 * services that started in the month. `billing` rows carry the contact the
 * QuickBooks customer matched, or null.
 */
export function billingMismatches(input: {
  month: string;
  asOf: string;
  billing: { customer: string; amount: number; contactId: string | null }[];
  records: (Dated & { contactId: string; contactName: string; product: string; basis: string; feeAmount: number | null })[];
}): CheckItem[] {
  const first = `${input.month}-01`;
  const [y, m] = input.month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const last = input.asOf < lastDay ? input.asOf : lastDay;
  const inMonth = (r: Dated) => r.startDate <= last && (r.endDate === null || r.endDate >= first);
  const items: CheckItem[] = [];

  const billed = new Map<string, { amount: number; customers: string[] }>();
  for (const row of input.billing) {
    if (!row.contactId) {
      items.push({
        kind: "billed-no-record",
        owner: "tom",
        contactId: null,
        name: row.customer,
        detail: `Billed ${usd(row.amount)} in ${input.month}; no matching contact or service record (no agreement on file?)`,
      });
      continue;
    }
    const seen = billed.get(row.contactId) ?? { amount: 0, customers: [] };
    seen.amount += row.amount;
    seen.customers.push(row.customer);
    billed.set(row.contactId, seen);
  }

  const names = new Map(input.records.map((r) => [r.contactId, r.contactName]));
  for (const [contactId, { amount, customers }] of billed) {
    const mine = input.records.filter((r) => r.contactId === contactId);
    const monthly = mine.filter((r) => r.basis === "monthly" && inMonth(r)).reduce((s, r) => s + (r.feeAmount ?? 0), 0);
    const oneTime = mine
      .filter((r) => r.basis === "one_time" && r.startDate >= first && r.startDate <= last)
      .reduce((s, r) => s + (r.feeAmount ?? 0), 0);
    const hourly = mine.some((r) => r.basis === "hourly" && inMonth(r));
    const name = names.get(contactId) ?? customers[0];
    if (!monthly && !oneTime && !hourly) {
      items.push({
        kind: "billed-no-record",
        owner: "tom",
        contactId,
        name,
        detail: `Billed ${usd(amount)} in ${input.month} (${customers.join(", ")}); no service record (no agreement on file?)`,
      });
    } else if (!hourly && Math.abs(amount - (monthly + oneTime)) > 0.005) {
      items.push({
        kind: "amount-differs",
        owner: "sol",
        contactId,
        name,
        detail: `Billed ${usd(amount)} in ${input.month}; agreed ${usd(monthly + oneTime)} (monthly ${usd(monthly)} + one-time ${usd(oneTime)})`,
      });
    }
  }

  const activeMonthly = new Map<string, number>();
  for (const r of input.records) {
    if (r.basis === "monthly" && isActiveOn(r, last)) activeMonthly.set(r.contactId, (activeMonthly.get(r.contactId) ?? 0) + (r.feeAmount ?? 0));
  }
  for (const [contactId, fee] of activeMonthly) {
    if (billed.has(contactId)) continue;
    items.push({
      kind: "no-invoice",
      owner: "sol",
      contactId,
      name: names.get(contactId) ?? contactId,
      detail: `Active monthly service ${usd(fee)}/mo; nothing billed in ${input.month} yet`,
    });
  }
  return items;
}
