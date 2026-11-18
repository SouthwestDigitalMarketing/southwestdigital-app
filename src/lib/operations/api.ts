import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { PLAYBOOK } from "./playbook";
import {
  EVIDENCE_STATUSES,
  buildBoard,
  firmDateKey,
  isOccurrence,
  latestPeriod,
  LOOKBACK_DAYS,
  type BoardEvidence,
  type EvidenceStatus,
} from "./schedule";

/**
 * Bearer token for agents. Only its SHA-256 is configured
 * (OPERATIONS_API_TOKEN_SHA256), the same scheme as the pipe API, but a
 * separate token so either can be revoked alone.
 */
export function authenticateOperationsRequest(
  authorization: string | null,
  env: Record<string, string | undefined> = process.env,
): { ok: true } | { ok: false; status: 401 | 503 } {
  const expected = env.OPERATIONS_API_TOKEN_SHA256?.trim().toLowerCase();
  if (!expected || !/^[0-9a-f]{64}$/.test(expected)) return { ok: false, status: 503 };
  const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return { ok: false, status: 401 };
  const presented = createHash("sha256").update(token).digest();
  return timingSafeEqual(presented, Buffer.from(expected, "hex")) ? { ok: true } : { ok: false, status: 401 };
}

const clean = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const KEY = /^[a-z0-9][a-z0-9-]{0,79}$/;

export type EvidenceInput = {
  dutyId: string;
  clientKey: string;
  period: string;
  status: EvidenceStatus;
  summary: string;
  details: unknown;
  sourceRef: string;
  reportedBy: string;
  sourceEventId: string;
  occurredAt: Date;
};

/** Validates an evidence post against the playbook. Returns an error message or the input. */
export function parseEvidence(raw: Record<string, unknown>, now: Date): EvidenceInput | string {
  const dutyId = clean(raw.duty, 80);
  const duty = PLAYBOOK.find((d) => d.id === dutyId);
  if (!duty) return `duty must be one of: ${PLAYBOOK.map((d) => d.id).join(", ")}`;
  const clientKey = clean(raw.client, 80);
  if (duty.scope === "client" && !clientKey) return `${dutyId} is a per-client duty: client is required`;
  if (duty.scope === "firm" && clientKey) return `${dutyId} is firm-wide: leave client out`;
  const status = clean(raw.status, 30) as EvidenceStatus;
  if (!EVIDENCE_STATUSES.includes(status)) return `status must be one of: ${EVIDENCE_STATUSES.join(", ")}`;
  const summary = clean(raw.summary, 1000);
  if (!summary) return "summary is required: what was found or done, with the numbers";
  const reportedBy = clean(raw.reportedBy, 80);
  if (!reportedBy) return "reportedBy is required (agent or person)";
  const sourceEventId = clean(raw.sourceEventId, 200);
  if (!sourceEventId) return "sourceEventId is required (any id unique to this report)";
  const occurredAt = raw.occurredAt === undefined ? now : new Date(String(raw.occurredAt));
  if (!Number.isFinite(occurredAt.getTime())) return "occurredAt must be an ISO date-time";
  const today = firmDateKey(now);
  const period = raw.period === undefined ? latestPeriod(duty, now) : clean(raw.period, 10);
  if (!period || !DATE.test(period)) return "period must be YYYY-MM-DD";
  if (period > today) return "period is in the future";
  if (!isOccurrence(duty, period)) return `${dutyId} is not due on ${period}`;
  return {
    dutyId,
    clientKey,
    period,
    status,
    summary,
    details: raw.details ?? null,
    sourceRef: clean(raw.sourceRef, 500),
    reportedBy,
    sourceEventId,
    occurredAt,
  };
}

export type ClientInput = {
  key: string;
  name: string;
  doubleClientId: number | null;
  qbCompany: string | null;
  startsOn: string;
  active: boolean;
};

export function parseClient(raw: Record<string, unknown>): ClientInput | string {
  const key = clean(raw.key, 80);
  if (!KEY.test(key)) return "key must be a lowercase slug, e.g. rodan-properties";
  const name = clean(raw.name, 200);
  if (!name) return "name is required";
  const startsOn = clean(raw.startsOn, 10);
  if (!DATE.test(startsOn)) return "startsOn must be YYYY-MM-DD";
  const double = raw.doubleClientId;
  if (double !== undefined && double !== null && !(Number.isInteger(double) && (double as number) > 0)) {
    return "doubleClientId must be a positive integer";
  }
  const qbCompany = clean(raw.qbCompany, 100);
  if (qbCompany && !KEY.test(qbCompany)) return "qbCompany must be the qb slug, e.g. bnb-getaway-llc";
  if (raw.active !== undefined && typeof raw.active !== "boolean") return "active must be true or false";
  return {
    key,
    name,
    doubleClientId: (double as number | null | undefined) ?? null,
    qbCompany: qbCompany || null,
    startsOn,
    active: raw.active === undefined ? true : (raw.active as boolean),
  };
}

const dateKey = (d: Date) => d.toISOString().slice(0, 10);

/** The Operations board for a brand: active clients and every occurrence in the window. */
export async function loadBoard(brandId: string, now: Date) {
  const since = new Date(now.getTime() - (LOOKBACK_DAYS + 1) * 86_400_000);
  const [clients, rows] = await Promise.all([
    prisma.operationsClient.findMany({
      where: { brandId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, key: true, name: true, startsOn: true },
    }),
    prisma.operationsEvidence.findMany({
      where: { brandId, period: { gte: since } },
      select: {
        dutyId: true,
        operationsClientId: true,
        period: true,
        status: true,
        summary: true,
        sourceRef: true,
        reportedBy: true,
        occurredAt: true,
      },
    }),
  ]);
  const boardClients = clients.map((c) => ({ id: c.id, key: c.key, name: c.name, startsOn: dateKey(c.startsOn) }));
  const evidence: BoardEvidence[] = rows.map((r) => ({
    dutyId: r.dutyId,
    clientId: r.operationsClientId,
    period: dateKey(r.period),
    status: r.status as EvidenceStatus,
    summary: r.summary,
    sourceRef: r.sourceRef,
    reportedBy: r.reportedBy,
    occurredAt: r.occurredAt,
  }));
  return { clients: boardClients, items: buildBoard({ now, clients: boardClients, evidence }) };
}
