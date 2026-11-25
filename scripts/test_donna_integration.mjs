// Run against the isolated Donna dev database and server only.
import assert from "node:assert/strict";
import { randomBytes, createHmac } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const url = new URL(process.env.DATABASE_URL ?? "");
if (url.hostname !== "127.0.0.1" || url.pathname !== "/swapp_donna")
  throw new Error(
    "Integration checks require the isolated local swapp_donna database.",
  );
const base = "http://100.98.89.93:3130";
const db = new PrismaClient();
const worker = (body, authorized = true) =>
  fetch(base + "/api/donna/worker", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:
        "Bearer " + (authorized ? process.env.DONNA_WORKER_TOKEN : "wrong"),
    },
    body: JSON.stringify(body),
  });
const brand = await db.brand.findUniqueOrThrow({
  where: { slug: "bookkeeping-conroe" },
});
const suffix = randomBytes(8).toString("hex");
const other = await db.brand.create({
  data: {
    slug: "donna-check-" + suffix,
    name: "Isolation fixture",
    status: "ACTIVE",
  },
});
const box = await db.donnaMailbox.create({
  data: {
    brandId: brand.id,
    key: "check-" + suffix,
    address: "fixture@example.com",
    paused: false,
    hookKey: randomBytes(32).toString("hex"),
    setupExpiresAt: new Date(Date.now() + 600000),
  },
});
try {
  assert.equal((await worker({ op: "claim" }, false)).status, 401);
  const hook = `${base}/api/donna/hooks/${brand.slug}/${box.id}/${box.hookKey}`;
  const raw = '{"messageId":1560840837125110001,"receivedTime":1795636800000}';
  const secret = randomBytes(32).toString("hex");
  const signature = createHmac("sha256", secret).update(raw).digest("base64");
  const sendHook = (sig = signature) =>
    fetch(hook, {
      method: "POST",
      body: raw,
      headers: {
        "Content-Type": "application/json",
        "x-hook-secret": secret,
        "x-hook-signature": sig,
      },
    });
  assert.equal((await sendHook("AA==")).status, 401);
  assert.equal((await sendHook()).status, 200);
  assert.equal((await sendHook()).status, 200);
  assert.equal(
    await db.donnaJob.count({ where: { mailboxId: box.id } }),
    1,
    "Repeated notifications must not create duplicate work.",
  );
  const results = await Promise.all([
    worker({ op: "claim" }).then((r) => r.json()),
    worker({ op: "claim" }).then((r) => r.json()),
  ]);
  const work = results.find((r) => r.work)?.work;
  assert.ok(work);
  assert.equal(
    results.filter((r) => r.work).length,
    1,
    "Only one worker may lease a mailbox.",
  );
  const now = new Date().toISOString();
  const draft = {
    from: "fixture@example.com",
    to: ["client@example.com"],
    cc: [],
    subject: "Re: Report",
    body: "Draft for review",
    attachments: [],
  };
  const request = {
    sourceKey: "fixture:report",
    sourceVersion: "source-v1",
    baseVersion: null,
    title: "Example: correct a report",
    person: "Example client",
    category: "client",
    owner: "Client delivery",
    state: "needs-you",
    urgent: true,
    summary: "Example correction request",
    recommendation: "Prepare the correction",
    nextAction: "Review the prepared answer",
    evidence: [
      {
        key: "fixture-message",
        from: "client@example.com",
        subject: "Report",
        at: now,
        excerpt: "Example source excerpt",
        folder: "INBOX",
        attachments: [],
      },
    ],
    draft,
    firstReceivedAt: now,
    dueAt: null,
    followUpAt: null,
    waitingOn: null,
    answeredAt: null,
    completionNote: null,
  };
  const packet = {
    jobId: work.job.id,
    leaseToken: work.job.leaseToken,
    requests: [request],
    activities: [
      {
        eventKey: "fixture-reviewed",
        messageKey: "fixture-message",
        kind: "reviewed",
        detail: "Example email reviewed",
        evidence: "Integration fixture, not live email",
        occurredAt: now,
        metadata: { requestKey: request.sourceKey },
      },
    ],
  };
  assert.equal((await worker({ op: "publish", packet })).status, 200);
  assert.equal((await worker({ op: "publish", packet })).status, 200);
  assert.equal(
    await db.donnaRequest.count({ where: { mailboxId: box.id } }),
    1,
  );
  assert.equal(
    await db.donnaActivity.count({
      where: { mailboxId: box.id, kind: "reviewed" },
    }),
    1,
  );
  let saved = await db.donnaRequest.findUniqueOrThrow({
    where: {
      mailboxId_sourceKey: { mailboxId: box.id, sourceKey: request.sourceKey },
    },
  });
  await db.donnaRequest.update({
    where: { id: saved.id },
    data: {
      draftEdited: true,
      version: { increment: 1 },
      draft: { ...draft, body: "My deliberate edit" },
    },
  });
  request.sourceVersion = "source-v2";
  request.baseVersion = 1;
  assert.equal(
    (await worker({ op: "publish", packet })).status,
    409,
    "A stale reviewer must not overwrite a human edit.",
  );
  request.baseVersion = 2;
  assert.equal((await worker({ op: "publish", packet })).status, 200);
  saved = await db.donnaRequest.findUniqueOrThrow({ where: { id: saved.id } });
  assert.equal(saved.draft.body, "My deliberate edit");
  assert.equal(saved.draftStale, true);
  await assert.rejects(
    () =>
      db.donnaRequest.update({
        where: { id: saved.id },
        data: {
          state: "handled",
          completedAt: new Date(),
          completionNote: null,
        },
      }),
    "The database must reject completion without evidence even if a caller bypasses input validation.",
  );
  assert.equal(
    (
      await worker({
        op: "complete",
        result: {
          jobId: work.job.id,
          leaseToken: work.job.leaseToken,
          coverage: {
            remaining_threads: 1,
            coverage_complete: false,
            gaps: [],
          },
        },
      })
    ).status,
    200,
  );
  assert.equal(
    await db.donnaJob.count({
      where: { mailboxId: box.id, status: "pending" },
    }),
    1,
    "A partial pass must queue its remaining backlog.",
  );
  await db.donnaMailbox.update({
    where: { id: box.id },
    data: { paused: true },
  });
  assert.equal((await (await worker({ op: "claim" })).json()).work, null);
  await db.donnaJob.create({
    data: {
      mailboxId: box.id,
      kind: "clean",
      eventKey: "clean:" + suffix,
    },
  });
  const cleanClaim = await (await worker({ op: "claim" })).json();
  assert.equal(cleanClaim.work?.job?.kind, "clean");
  assert.equal(
    (
      await worker({
        op: "heartbeat",
        jobId: cleanClaim.work.job.id,
        leaseToken: cleanClaim.work.job.leaseToken,
      })
    ).status,
    200,
    "A Clean lease must stay alive on a paused mailbox.",
  );
  const pendingBeforeClean = await db.donnaJob.count({
    where: { mailboxId: box.id, status: "pending" },
  });
  assert.equal(
    (
      await worker({
        op: "complete",
        result: {
          jobId: cleanClaim.work.job.id,
          leaseToken: cleanClaim.work.job.leaseToken,
          coverage: {
            remaining_threads: 9,
            coverage_complete: false,
            clean: {
              at: "2026-11-25T18:00:00Z",
              reviewed: 1,
              remaining: 9,
              filed: [],
              waiting: [],
              needsYou: [],
              skipped: [],
            },
          },
        },
      })
    ).status,
    200,
  );
  assert.equal(
    await db.donnaJob.count({
      where: { mailboxId: box.id, status: "pending" },
    }),
    pendingBeforeClean,
    "Clean must not queue a backlog pass while the mailbox is paused.",
  );
  const boxAfterClean = await db.donnaMailbox.findUniqueOrThrow({
    where: { id: box.id },
  });
  assert.equal(boxAfterClean.coverage.clean.reviewed, 1);

  const role = "donna_rls_" + suffix;
  await db.$executeRawUnsafe(`CREATE ROLE ${role} NOLOGIN`);
  try {
    await db.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${role}`);
    await db.$executeRawUnsafe(
      `GRANT SELECT ON "DonnaMailbox", "DonnaRequest", "DonnaActivity", "DonnaJob" TO ${role}`,
    );
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
      await tx.$queryRaw`SELECT set_config('app.current_brand_id', ${other.id}, true)`;
      assert.equal(
        await tx.donnaRequest.count(),
        0,
        "Other brands cannot see these requests.",
      );
      await tx.$queryRaw`SELECT set_config('app.current_brand_id', ${brand.id}, true)`;
      assert.equal(
        await tx.donnaRequest.count({ where: { mailboxId: box.id } }),
        1,
      );
    });
  } finally {
    await db.$executeRawUnsafe(`DROP OWNED BY ${role}`);
    await db.$executeRawUnsafe(`DROP ROLE ${role}`);
  }
  console.log(
    "Donna integration checks passed: signed enrollment, invalid signatures, deduplication, exclusive leases, replay-safe publish, human-edit preservation, backlog recovery, pause and tenant RLS.",
  );
} finally {
  await db.donnaMailbox.delete({ where: { id: box.id } });
  await db.brand.delete({ where: { id: other.id } });
  await db.$disconnect();
}
