import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/simpleRateLimit";
import { COMPANY_BRANDS } from "@/lib/companyMetrics";
import { parsePipeContactInput, toE164, upsertPipeContact } from "@/lib/pipe/contacts";
import { createBrandDataContext, withBrandDataTransaction } from "@/lib/tenancy/context";
import { checkScanToken } from "@/lib/scan/auth";
import { computeInternalChanges } from "@/lib/scan/internal";
import { applyTagEvidence } from "@/lib/scan/tags";
import { MAX_OPEN_QUESTIONS, QUESTION_OPTIONS, proposeBroaderRules, syncQuestions, type QuestionKind } from "@/lib/scan/questions";
import { postScanFinding } from "@/lib/scanner/post";
import { isScanRoom, type ScanRoom } from "@/lib/scanner/vocab";
import {
  looksLikeSignedReply,
  parseScanChange,
  parseScanLead,
  parseSignedHint,
  type ScanChange,
} from "@/lib/scan/scan";
import { initialSources, type ScanSourceState } from "@/lib/scan/sources";

type ReviewItem = { brand: string; room: ScanRoom; key: string; what: string; evidence: string; ref: Record<string, unknown> | null };

function questionKindForReview(item: ReviewItem): QuestionKind | null {
  if (item.room === "phone" && item.key.startsWith("scan-cleanup:sms:")) return "sms-lead";
  if (item.room === "inbox" && item.key.startsWith("scan-cleanup:form:")) return "form-brand";
  return null;
}

function cleanCapped(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

function parseReviewItem(raw: unknown): ReviewItem | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const brand = cleanCapped(row.brand, 80);
  const room = cleanCapped(row.room, 40);
  const key = cleanCapped(row.key, 200);
  const what = cleanCapped(row.what, 500);
  const evidence = cleanCapped(row.evidence, 4000);
  if (!brand || !room || !key || !what || !evidence || !isScanRoom(room)) return null;
  const ref = row.ref && typeof row.ref === "object" && !Array.isArray(row.ref) ? (row.ref as Record<string, unknown>) : null;
  return { brand, room, key, what, evidence, ref };
}

/** Uncertain cleanup items become review-list findings, never the bin. */
const REVIEW_KIND: Record<ScanRoom, string> = {
  phone: "quo",
  inbox: "zoho",
  payments: "swapp",
  contracts: "swapp",
  "non-inbox": "zoho",
  pipeline: "swapp",
};

/** Quotes that went out but show no acceptance: a "signed" hint is worth flagging. */
const OPEN_QUOTE_STATUSES = ["sent", "completed"];

export const dynamic = "force-dynamic";

const LOCH_SIDE = [...COMPANY_BRANDS];

/** Ripley pushes a finished run back: external findings plus the leads and
 * signed-hints it gathered. SWapp creates the leads, matches the hints, adds
 * its own proposal and traffic changes, and closes the run. */
export async function POST(request: Request) {
  const auth = checkScanToken(request.headers.get("authorization"));
  if (!auth.ok) {
    const message = auth.status === 503 ? "Scan is not configured." : "Unauthorized.";
    return NextResponse.json({ error: message }, { status: auth.status });
  }
  if (!checkRateLimit("scan-complete", 30, 60_000).allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const runId = typeof body?.runId === "string" ? body.runId : "";
  if (!runId) return NextResponse.json({ error: "runId is required." }, { status: 400 });
  const run = await prisma.scanRun.findUnique({ where: { id: runId } });
  if (!run) return NextResponse.json({ error: "Scan run not found." }, { status: 404 });
  if (run.status !== "running") return NextResponse.json({ error: "Scan run is not running." }, { status: 409 });

  const external: ScanChange[] = Array.isArray(body?.changes)
    ? body.changes.map(parseScanChange).filter((change): change is ScanChange => change !== null).slice(0, 20)
    : [];
  const leadInputs = Array.isArray(body?.leads)
    ? body.leads.map(parseScanLead).filter((lead) => lead !== null).slice(0, 20)
    : [];
  const hints = Array.isArray(body?.signedHints)
    ? body.signedHints.map(parseSignedHint).filter((hint) => hint !== null).slice(0, 20)
    : [];
  const sourceSummary = body?.summary && typeof body.summary === "object" ? body.summary : {};

  const brands = await prisma.brand.findMany({
    where: { slug: { in: LOCH_SIDE }, status: "ACTIVE" },
    select: { id: true, slug: true },
  });
  const brandBySlug = new Map(brands.map((brand) => [brand.slug, brand.id]));

  const changes: ScanChange[] = [...external];
  let leadsCreated = 0;

  for (const input of leadInputs) {
    const brandId = brandBySlug.get(input.brand);
    if (!brandId) continue;
    const email = input.email;
    const phone = input.phone ? (toE164(input.phone) ?? input.phone) : null;
    const duplicate = await prisma.lead.findFirst({
      where: {
        brandId,
        status: { in: ["NEW", "CONTACTED"] },
        ...(email ? { normalizedEmail: email } : phone ? { phoneE164: phone } : { id: "__none__" }),
      },
      select: { id: true },
    });
    if (duplicate) continue;
    const context = createBrandDataContext({ brandId, actorUserId: auth.actorUserId });
    const note = [`Source: scan (${input.source}${input.sourceDetail ? ` — ${input.sourceDetail}` : ""})`, input.note]
      .filter(Boolean)
      .join("\n");
    await withBrandDataTransaction(context, (tx) =>
      tx.lead.create({
        data: {
          brandId,
          name: input.name,
          company: input.company,
          email,
          normalizedEmail: email,
          phoneE164: phone,
          status: "NEW",
          source: "scan",
          sourceDetail: `${input.source}${input.sourceDetail ? ` — ${input.sourceDetail}` : ""}`.slice(0, 200),
          notes: note.slice(0, 2000),
        },
      }),
    );
    try {
      await upsertPipeContact({
        actorUserId: auth.actorUserId,
        input: parsePipeContactInput({
          brand: input.brand,
          name: input.name,
          email: input.email,
          phone: input.phone,
          company: input.company,
        }),
      });
    } catch {
      // The lead is saved; the contact card retry happens on the next scan.
    }
    leadsCreated += 1;
    changes.push({ kind: input.source, text: `New lead: ${input.name}${input.company ? ` (${input.company})` : ""}` });
  }

  for (const hint of hints) {
    if (!looksLikeSignedReply(hint.subject ?? null, hint.snippet ?? null)) continue;
    const haystack = `${hint.subject ?? ""} ${hint.snippet ?? ""}`.toLowerCase();
    const openClients = await prisma.quoteClient.findMany({
      where: {
        brandId: { in: [...brandBySlug.values()] },
        quotes: { some: { status: { in: OPEN_QUOTE_STATUSES } } },
      },
      select: { id: true, brandId: true, name: true, email: true, company: true, notes: true },
    });
    const client =
      openClients.find((row) => row.email.toLowerCase() === hint.fromEmail) ??
      openClients.find(
        (row) =>
          (row.company && row.company.length >= 4 && haystack.includes(row.company.toLowerCase())) ||
          (row.name && row.name.length >= 4 && haystack.includes(row.name.toLowerCase())),
      );
    if (!client) continue;
    const who = client.name || hint.fromName || hint.fromEmail;
    changes.push({ kind: "zoho", text: `${who}: client says signed — check QuickBooks` });
    const stamp = `Scan ${new Date().toISOString().slice(0, 10)}: ${hint.fromEmail} reply hints the sent GSA came back signed — verify in QuickBooks (documents rule: never auto-mark).`;
    await prisma.quoteClient.update({
      where: { id: client.id },
      data: { notes: `${client.notes ? `${client.notes}\n` : ""}${stamp}`.slice(0, 4000) },
    });
    const lead = await prisma.lead.findFirst({
      where: { brandId: client.brandId, normalizedEmail: hint.fromEmail },
      select: { id: true, notes: true },
    });
    if (lead) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { notes: `${lead.notes ? `${lead.notes}\n` : ""}${stamp}`.slice(0, 4000) },
      });
    }
  }

  const brandList = [...brandBySlug.entries()].map(([slug, id]) => ({ id, slug }));
  const synced = await syncQuestions(prisma, brandList.map((brand) => brand.id));
  const proposed = await proposeBroaderRules(prisma, brandList);
  const autoApplied = Array.isArray(body?.autoApplied) ? body.autoApplied.filter((item): item is string => typeof item === "string").slice(0, 10) : [];

  const previousDone = await prisma.scanRun.findFirst({
    where: { status: "done" },
    orderBy: { finishedAt: "desc" },
  });
  const internal = await computeInternalChanges(prisma, previousDone?.finishedAt ?? null);
  changes.push(...internal.changes);

  const tags = await applyTagEvidence({
    db: prisma,
    actorUserId: auth.actorUserId,
    brands: [...brandBySlug.entries()].map(([slug, id]) => ({ id, slug })),
    since: previousDone?.finishedAt ?? null,
  });
  changes.push(...tags.changes);
  if (tags.judgments > 0) {
    changes.push({ kind: "swapp", text: `${tags.judgments} need${tags.judgments === 1 ? "s" : ""} your call (review list)` });
  }

  const reviewItems = Array.isArray(body?.reviewItems)
    ? body.reviewItems.map(parseReviewItem).filter((item): item is ReviewItem => item !== null).slice(0, 20)
    : [];
  let reviewFiled = 0;
  for (const item of reviewItems) {
    const brandId = brandBySlug.get(item.brand);
    if (!brandId) continue;
    await postScanFinding({
      brandId,
      actorUserId: auth.actorUserId,
      input: {
        brand: item.brand,
        room: item.room,
        key: item.key,
        what: item.what,
        severity: "normal",
        evidence: item.evidence,
        fixLevel: 2,
        role: item.room === "inbox" ? "mail-desk" : "sales-pipeline",
        presence: "open",
        doneNote: null,
      },
    });
    reviewFiled += 1;
    changes.push({ kind: REVIEW_KIND[item.room], text: item.what });
    const kind = questionKindForReview(item);
    if (kind && item.ref) {
      const openCount = await prisma.scanQuestion.count({ where: { brandId, status: "open" } });
      if (openCount < MAX_OPEN_QUESTIONS) {
        const dup = await prisma.scanQuestion.findFirst({
          where: { brandId, kind, status: "open" },
          select: { id: true, ref: true },
        });
        const sameRef = dup && JSON.stringify((dup.ref ?? {}) as object) === JSON.stringify(item.ref);
        if (!sameRef) {
          await prisma.scanQuestion.create({
            data: {
              brandId,
              kind,
              ref: item.ref as Prisma.InputJsonValue,
              findingId: null,
              what: item.what,
              options: QUESTION_OPTIONS[kind] as unknown as Prisma.InputJsonValue,
              severity: "normal",
            },
          });
        }
      }
    }
  }


  const currentSources: ScanSourceState[] = Array.isArray(run.sources)
    ? (run.sources as ScanSourceState[])
    : initialSources();
  if (internal.ga4NeedsLogin) {
    const ga4 = currentSources.find((row) => row.source === "ga4");
    if (ga4) {
      ga4.status = "needs-you";
      ga4.detail = "Traffic refresh needs the GA key on the server";
    }
  }
  // Only the per-source SOP reviewer can earn a checkmark. Completing the
  // collector run does not prove that native inboxes and pending work are clear.
  const sources = currentSources.map((row) => {
    if (row.status === "done" || row.status === "needs-you") return row;
    return {
      ...row,
      status: "needs-you" as const,
      detail: "SOP review has not verified this source; retry the review",
    };
  });

  const finishedAt = new Date();
  await prisma.scanRun.update({
    where: { id: run.id },
    data: {
      status: "done",
      finishedAt,
      summary: { sources: sourceSummary, leadsCreated, signedHints: hints.length, ga4: internal.ga4, tags: { fixed: tags.fixed, judgments: tags.judgments }, review: reviewFiled, questions: synced, proposed: proposed.created, autoApplied },
      changes: changes.slice(0, 30),
      sources,
    },
  });
  return NextResponse.json({ saved: changes.length, leadsCreated });
}
