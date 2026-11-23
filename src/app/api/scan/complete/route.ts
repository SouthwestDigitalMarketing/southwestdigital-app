import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/simpleRateLimit";
import { COMPANY_BRANDS } from "@/lib/companyMetrics";
import { parsePipeContactInput, toE164, upsertPipeContact } from "@/lib/pipe/contacts";
import { createBrandDataContext, withBrandDataTransaction } from "@/lib/tenancy/context";
import { checkScanToken } from "@/lib/scan/auth";
import { computeInternalChanges } from "@/lib/scan/internal";
import {
  looksLikeSignedReply,
  parseScanChange,
  parseScanLead,
  parseSignedHint,
  type ScanChange,
} from "@/lib/scan/scan";
import { initialSources, type ScanSourceState } from "@/lib/scan/sources";

/** Which source rows a change kind belongs to on the modal. */
const KIND_SOURCES: Record<string, string[]> = {
  quo: ["quo-sms", "quo-calls", "quo-voicemail"],
  zoho: ["zoho"],
  swapp: ["swapp"],
  ga4: ["ga4"],
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

  const previousDone = await prisma.scanRun.findFirst({
    where: { status: "done" },
    orderBy: { finishedAt: "desc" },
  });
  const internal = await computeInternalChanges(prisma, previousDone?.finishedAt ?? null);
  changes.push(...internal.changes);

  const currentSources: ScanSourceState[] = Array.isArray(run.sources)
    ? (run.sources as ScanSourceState[])
    : initialSources();
  const bySource = new Map<string, string[]>();
  for (const change of changes) {
    for (const key of KIND_SOURCES[change.kind] ?? []) {
      const list = bySource.get(key) ?? [];
      list.push(change.text);
      bySource.set(key, list);
    }
  }
  if (internal.ga4NeedsLogin) {
    const ga4 = currentSources.find((row) => row.source === "ga4");
    if (ga4) {
      ga4.status = "needs-you";
      ga4.detail = "Traffic refresh needs the GA key on the server";
    }
  }
  const sources = currentSources.map((row) => {
    if (row.status === "needs-you") return row;
    const detail = bySource.get(row.source);
    return { ...row, status: "done" as const, detail: detail ? detail.join("; ").slice(0, 280) : "No changes" };
  });

  const finishedAt = new Date();
  await prisma.scanRun.update({
    where: { id: run.id },
    data: {
      status: "done",
      finishedAt,
      summary: { sources: sourceSummary, leadsCreated, signedHints: hints.length, ga4: internal.ga4 },
      changes: changes.slice(0, 30),
      sources,
    },
  });
  return NextResponse.json({ saved: changes.length, leadsCreated });
}
