/**
 * Scorecard ingest (docs/scorecard.md § Flow, step 2). The collector on
 * ripley posts timing events; this validates them, works out the clock and
 * business seconds, and upserts them by (brandId, sourceKey) so a repeated
 * run updates rows instead of adding copies.
 *
 * ScorecardEvent is not under row-level security (like OperationsEvidence),
 * so the plain prisma client is used; the brand comes from the posted slug.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { businessSecondsBetween, clockSecondsBetween } from "./hours";
import {
  SCORECARD_CHANNELS,
  SCORECARD_KINDS,
  SCORECARD_SOURCES,
  type ScorecardChannel,
  type ScorecardKind,
  type ScorecardSource,
} from "./types";

export const MAX_EVENTS = 500;
const SOURCE_KEY = /^[a-z0-9:._-]{3,200}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:?\d{2})$/;
/** Collector clocks may drift a little; anything further ahead is a bug. */
const FUTURE_SLACK_MS = 5 * 60_000;
const MAX_DETAILS_CHARS = 2000;

/** Which channel each kind belongs to. */
export const KIND_CHANNEL: Record<ScorecardKind, ScorecardChannel> = {
  text_reply: "text",
  call_answered: "call",
  call_missed: "call",
  email_reply: "email",
  report_delivered: "report",
};

export type ParsedEvent = {
  sourceKey: string;
  channel: ScorecardChannel;
  kind: ScorecardKind;
  contactId: string | null;
  startedAt: Date;
  respondedAt: Date | null;
  clockSeconds: number | null;
  businessSeconds: number | null;
  responseVia: string | null;
  details: Record<string, unknown> | null;
};

export type ParsedSync = { source: ScorecardSource; coveredTo: Date | null; ok: boolean; note: string | null };

export type RejectedEvent = { index: number; sourceKey: string | null; error: string };

export type ParsedIngest = {
  brand: string;
  events: ParsedEvent[];
  rejected: RejectedEvent[];
  sync: ParsedSync | null;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

/** An ISO 8601 date-time with offset or Z, or null when it is not one. */
export function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== "string" || !ISO.test(value.trim())) return null;
  const at = new Date(value.trim());
  return Number.isFinite(at.getTime()) ? at : null;
}

function optionalString(value: unknown, max: number, name: string): string | null | { error: string } {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return { error: `${name} must be a string or null` };
  const text = value.trim();
  if (text.length > max) return { error: `${name} is longer than ${max} characters` };
  return text || null;
}

/** Validates one event. Returns the event with its spans, or an error message. */
export function parseEvent(raw: unknown, now: Date): ParsedEvent | string {
  if (!isObject(raw)) return "event must be an object";
  const sourceKey = typeof raw.sourceKey === "string" ? raw.sourceKey.trim() : "";
  if (!SOURCE_KEY.test(sourceKey)) return "sourceKey must be 3-200 characters of letters, digits and : . _ -";
  const channel = raw.channel as ScorecardChannel;
  if (!SCORECARD_CHANNELS.includes(channel)) return `channel must be one of: ${SCORECARD_CHANNELS.join(", ")}`;
  const kind = raw.kind as ScorecardKind;
  if (!SCORECARD_KINDS.includes(kind)) return `kind must be one of: ${SCORECARD_KINDS.join(", ")}`;
  if (KIND_CHANNEL[kind] !== channel) return `kind ${kind} belongs to channel ${KIND_CHANNEL[kind]}`;
  const contactId = optionalString(raw.contactId, 64, "contactId");
  if (isObject(contactId)) return contactId.error;
  const startedAt = parseIsoDate(raw.startedAt);
  if (!startedAt) return "startedAt must be an ISO 8601 date-time with offset or Z";
  if (startedAt.getTime() > now.getTime() + FUTURE_SLACK_MS) return "startedAt is in the future";
  let respondedAt: Date | null = null;
  if (raw.respondedAt !== undefined && raw.respondedAt !== null) {
    respondedAt = parseIsoDate(raw.respondedAt);
    if (!respondedAt) return "respondedAt must be an ISO 8601 date-time with offset or Z, or null";
    if (respondedAt.getTime() < startedAt.getTime()) return "respondedAt is before startedAt";
    if (respondedAt.getTime() > now.getTime() + FUTURE_SLACK_MS) return "respondedAt is in the future";
  }
  const responseVia = optionalString(raw.responseVia, 40, "responseVia");
  if (isObject(responseVia)) return responseVia.error;
  let details: Record<string, unknown> | null = null;
  if (raw.details !== undefined && raw.details !== null) {
    if (!isObject(raw.details)) return "details must be an object or null";
    if (JSON.stringify(raw.details).length > MAX_DETAILS_CHARS) return `details is longer than ${MAX_DETAILS_CHARS} characters`;
    details = raw.details;
  }
  return {
    sourceKey,
    channel,
    kind,
    contactId,
    startedAt,
    respondedAt,
    clockSeconds: respondedAt ? clockSecondsBetween(startedAt, respondedAt) : null,
    businessSeconds: respondedAt ? businessSecondsBetween(startedAt, respondedAt) : null,
    responseVia,
    details,
  };
}

export function parseSync(raw: unknown): ParsedSync | string {
  if (!isObject(raw)) return "sync must be an object or null";
  const source = raw.source as ScorecardSource;
  if (!SCORECARD_SOURCES.includes(source)) return `sync.source must be one of: ${SCORECARD_SOURCES.join(", ")}`;
  let coveredTo: Date | null = null;
  if (raw.coveredTo !== undefined && raw.coveredTo !== null) {
    coveredTo = parseIsoDate(raw.coveredTo);
    if (!coveredTo) return "sync.coveredTo must be an ISO 8601 date-time or null";
  }
  if (typeof raw.ok !== "boolean") return "sync.ok must be true or false";
  const note = optionalString(raw.note, 500, "sync.note");
  if (isObject(note)) return note.error;
  return { source, coveredTo, ok: raw.ok, note };
}

/**
 * Validates a whole post. A bad body (no brand, no events array, too many
 * events, bad sync) is an error message; a bad event is only rejected on its
 * own and listed, so one odd row never blocks a batch. A sourceKey repeated in
 * the same post keeps its last copy.
 */
export function parseIngestBody(raw: unknown, now: Date): ParsedIngest | string {
  if (!isObject(raw)) return "A JSON object is required.";
  const brand = typeof raw.brand === "string" ? raw.brand.trim() : "";
  if (!brand) return "brand is required (brand slug)";
  if (!Array.isArray(raw.events)) return "events must be an array";
  if (raw.events.length > MAX_EVENTS) return `at most ${MAX_EVENTS} events per post`;
  let sync: ParsedSync | null = null;
  if (raw.sync !== undefined && raw.sync !== null) {
    const parsed = parseSync(raw.sync);
    if (typeof parsed === "string") return parsed;
    sync = parsed;
  }
  const byKey = new Map<string, ParsedEvent>();
  const rejected: RejectedEvent[] = [];
  raw.events.forEach((item, index) => {
    const parsed = parseEvent(item, now);
    if (typeof parsed === "string") {
      const key = isObject(item) && typeof item.sourceKey === "string" ? item.sourceKey.slice(0, 200) : null;
      rejected.push({ index, sourceKey: key, error: parsed });
    } else {
      byKey.delete(parsed.sourceKey);
      byKey.set(parsed.sourceKey, parsed);
    }
  });
  return { brand, events: [...byKey.values()], rejected, sync };
}

export type IngestResult = {
  received: number;
  created: number;
  updated: number;
  rejected: RejectedEvent[];
  /** Events whose contactId is not a contact of this brand; stored with no contact. */
  contactsDropped: number;
};

/** Writes parsed events and the sync row for a brand. */
export async function ingestScorecard(brandId: string, input: ParsedIngest, now: Date): Promise<IngestResult> {
  const contactIds = [...new Set(input.events.flatMap((e) => (e.contactId ? [e.contactId] : [])))];
  const keys = input.events.map((e) => e.sourceKey);
  const [contacts, existing] = await Promise.all([
    contactIds.length
      ? prisma.contact.findMany({ where: { brandId, id: { in: contactIds } }, select: { id: true } })
      : Promise.resolve([]),
    keys.length
      ? prisma.scorecardEvent.findMany({ where: { brandId, sourceKey: { in: keys } }, select: { sourceKey: true } })
      : Promise.resolve([]),
  ]);
  const known = new Set(contacts.map((c) => c.id));
  const seen = new Set(existing.map((e) => e.sourceKey));
  let contactsDropped = 0;
  const writes = input.events.map((event) => {
    let contactId = event.contactId;
    if (contactId && !known.has(contactId)) {
      contactId = null;
      contactsDropped += 1;
    }
    const data = {
      contactId,
      channel: event.channel,
      kind: event.kind,
      startedAt: event.startedAt,
      respondedAt: event.respondedAt,
      clockSeconds: event.clockSeconds,
      businessSeconds: event.businessSeconds,
      responseVia: event.responseVia,
      details: event.details === null ? Prisma.JsonNull : (event.details as Prisma.InputJsonValue),
    };
    return prisma.scorecardEvent.upsert({
      where: { brandId_sourceKey: { brandId, sourceKey: event.sourceKey } },
      create: { brandId, sourceKey: event.sourceKey, ...data },
      update: data,
      select: { id: true },
    });
  });
  if (writes.length) await prisma.$transaction(writes);
  if (input.sync) {
    const sync = {
      lastRunAt: now,
      coveredTo: input.sync.coveredTo,
      eventsSent: input.events.length,
      ok: input.sync.ok,
      note: input.sync.note,
    };
    await prisma.scorecardSync.upsert({
      where: { brandId_source: { brandId, source: input.sync.source } },
      create: { brandId, source: input.sync.source, ...sync },
      update: sync,
    });
  }
  const created = input.events.filter((e) => !seen.has(e.sourceKey)).length;
  return {
    received: input.events.length + input.rejected.length,
    created,
    updated: input.events.length - created,
    rejected: input.rejected,
    contactsDropped,
  };
}
