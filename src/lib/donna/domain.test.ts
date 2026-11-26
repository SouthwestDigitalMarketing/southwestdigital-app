import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  activityCounts,
  mailboxHealth,
  coverageLabel,
  mailboxFolders,
  mailboxFolderTables,
  donnaActionCounts,
  mailboxCleanReport,
  cleanReport,
  cleanIsPreview,
  cleanIsSort,
  cleanBuckets,
  donnaSettings,
  cleanBarStatus,
  formatCleanEta,
  deferredRetryNote,
  requestSchema,
  verifyHook,
} from "./domain";
import { activityPeriod } from "./period";
import { readBoundedBody } from "./http";

describe("webhook body bounds", () => {
  it("rejects oversized streaming bodies without trusting Content-Length", async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(8));
        controller.enqueue(new Uint8Array(8));
        controller.close();
      },
    });
    const request = new Request("https://example.test", {
      method: "POST",
      body,
      duplex: "half",
    } as RequestInit);
    expect(await readBoundedBody(request, 10)).toBeNull();
  });
  it("preserves exact signed bytes across chunks", async () => {
    const request = new Request("https://example.test", {
      method: "POST",
      body: "é",
    });
    expect(await readBoundedBody(request, 10)).toEqual(Buffer.from("é"));
  });
});

describe("Zoho webhook verification", () => {
  const secret = "enrolled-secret";
  const body = Buffer.from('{"messageId":"123","subject":"é"}');
  const signature = createHmac("sha256", secret).update(body).digest("base64");
  it("accepts only the exact signed bytes", () => {
    expect(verifyHook(body, signature, secret)).toBe(true);
    expect(
      verifyHook(Buffer.concat([body, Buffer.from(" ")]), signature, secret),
    ).toBe(false);
    expect(verifyHook(body, signature, "different-secret")).toBe(false);
  });
  it("rejects missing, malformed and truncated signatures", () => {
    for (const invalid of [null, "", "%%%", "AA==", signature.slice(1)])
      expect(verifyHook(body, invalid, secret)).toBe(false);
  });
});

describe("honest health and counts", () => {
  it("keeps an unreviewed backlog visible instead of claiming the desk is clear", () => {
    expect(coverageLabel({})).toBe("Coverage not verified yet.");
    const label = coverageLabel({
      folders: [{ folder: "INBOX" }],
      message_locations: 2000,
      remaining_threads: 1900,
      coverage_complete: false,
    });
    expect(label).toContain("1,900 conversations await review");
    expect(label).not.toContain("All inventoried conversations reviewed");
  });
  it("lists mailbox folders with message counts, Inbox first", () => {
    expect(mailboxFolders({})).toEqual([]);
    expect(
      mailboxFolders({
        folders: [
          { folder: "Newsletter", messages: 451 },
          { folder: "INBOX", messages: 73.9 },
          { folder: "Spam", messages: 209 },
          { folder: "", messages: 3 },
          { folder: "Bills", messages: 7 },
        ],
      }),
    ).toEqual([
      {
        folder: "INBOX",
        label: "Inbox",
        messages: 73,
        zohoDefault: true,
      },
      {
        folder: "Spam",
        label: "Spam",
        messages: 209,
        zohoDefault: true,
      },
      {
        folder: "Bills",
        label: "Bills",
        messages: 7,
        zohoDefault: false,
      },
      {
        folder: "Newsletter",
        label: "Newsletter",
        messages: 451,
        zohoDefault: false,
      },
    ]);
  });
  it("splits Zoho default folders from custom folders", () => {
    expect(
      mailboxFolderTables({
        folders: [
          { folder: "Cold Outreach", messages: 226 },
          { folder: "Archive", messages: 634 },
          { folder: "INBOX", messages: 73 },
          { folder: "Newsletter", messages: 451 },
        ],
      }),
    ).toEqual({
      zoho: [
        {
          folder: "INBOX",
          label: "Inbox",
          messages: 73,
          zohoDefault: true,
        },
        {
          folder: "Archive",
          label: "Archive",
          messages: 634,
          zohoDefault: true,
        },
      ],
      custom: [
        {
          folder: "Cold Outreach",
          label: "Cold Outreach",
          messages: 226,
          zohoDefault: false,
        },
        {
          folder: "Newsletter",
          label: "Newsletter",
          messages: 451,
          zohoDefault: false,
        },
      ],
    });
  });
  const box = {
    paused: false,
    heartbeatAt: new Date("2026-11-25T18:00:00Z"),
    lastError: null,
    lastCheckedAt: new Date("2026-11-25T17:59:00Z"),
    hookSecret: "encrypted",
  };
  const now = new Date("2026-11-25T18:00:30Z");
  it("reads action counts from the same folder table", () => {
    expect(
      donnaActionCounts({
        folders: [
          { folder: "INBOX", messages: 73 },
          { folder: "Spam", messages: 209 },
          { folder: "Notification", messages: 445 },
          { folder: "Trash", messages: 406 },
          { folder: "Drafts", messages: 19 },
          { folder: "Newsletter", messages: 451 },
        ],
      }),
    ).toEqual({
      inbox: 73,
      spam: 209,
      notifications: 445,
      trash: 406,
      drafts: 19,
      all: 1152,
    });
  });
  it("formats a clean ETA in short words", () => {
    expect(formatCleanEta(20)).toBe("Under a minute left");
    expect(formatCleanEta(60)).toBe("About 1 min left");
    expect(formatCleanEta(8 * 60)).toBe("About 8 min left");
    expect(formatCleanEta(70 * 60)).toBe("About 1 hr left");
  });

  it("builds the Cleaning inbox bar from job status and coverage", () => {
    const folders = [{ folder: "INBOX", messages: 75 }];
    expect(
      cleanBarStatus({ id: "job-1", status: "pending" }, { folders }),
    ).toMatchObject({
      id: "job-1",
      waiting: true,
      total: 75,
      done: 0,
      percent: 0,
      label: "Waiting for Donna",
      countLabel: "0 of 75",
      etaLabel: null,
    });
    expect(
      cleanBarStatus(
        { id: "job-1", status: "leased" },
        {
          folders,
          cleanProgress: {
            total: 75,
            done: 12,
            current: "Weekly digest",
            startedAt: "2026-11-26T00:00:00Z",
          },
        },
        new Date("2026-11-26T00:08:00Z"),
      ),
    ).toMatchObject({
      waiting: false,
      done: 12,
      percent: 16,
      label: "Weekly digest",
      countLabel: "12 of 75",
      etaLabel: "About 42 min left",
    });
  });

  it("labels a preview, a real clean and a paused mailbox on the bar", () => {
    expect(cleanIsPreview({})).toBe(false);
    expect(cleanIsPreview({ manual: true })).toBe(false);
    expect(cleanIsPreview({ preview: true })).toBe(true);
    expect(cleanIsPreview({ previewJobId: "p", plan: [] })).toBe(false);
    const coverage = { cleanProgress: { total: 5, done: 1 } };
    expect(
      cleanBarStatus(
        { id: "j", status: "leased", options: { preview: true } },
        coverage,
      ),
    ).toMatchObject({ title: "Checking inbox", waiting: false, paused: false });
    expect(
      cleanBarStatus(
        { id: "j", status: "leased", options: { plan: [{ thread: "a" }] } },
        coverage,
      ),
    ).toMatchObject({ title: "Cleaning inbox", label: "Cleaning inbox" });
    expect(
      cleanBarStatus(
        { id: "j", status: "leased", options: {} },
        coverage,
        new Date(),
        true,
      ),
    ).toMatchObject({
      paused: true,
      waiting: true,
      label: "Paused",
      etaLabel: null,
    });
  });

  it("says plainly when no worker is running to pick up a clean", () => {
    const now = new Date("2026-11-26T02:00:00Z");
    const job = { id: "j", status: "pending", options: {} };
    expect(cleanBarStatus(job, {}, now, false, null)).toMatchObject({
      offline: true,
      label: "Donna is not running",
    });
    expect(
      cleanBarStatus(job, {}, now, false, new Date("2026-11-26T01:59:40Z")),
    ).toMatchObject({ offline: false, label: "Waiting for Donna" });
    expect(cleanBarStatus(job, {}, now, true, null)).toMatchObject({
      offline: false,
      label: "Paused",
    });
  });

  it("reads a job's own report with thread ids and undo state", () => {
    const report = cleanReport({
      preview: false,
      cancelled: true,
      at: "2026-11-26T00:00:00Z",
      reviewed: 0,
      remaining: 0,
      filed: [
        {
          thread: "ab12",
          subject: "Sale",
          from: "x@shop.example",
          folder: "Newsletter",
          undone: true,
        },
        {
          thread: "cd34",
          subject: "Promo",
          from: "y@shop.example",
          folder: "Spam",
          undoPending: true,
        },
        {
          thread: "not hex!",
          subject: "Odd",
          folder: "Spam",
          undoError: "Message is no longer in Spam.",
        },
      ],
    });
    expect(report?.cancelled).toBe(true);
    expect(
      report?.filed.map((i) => [i.thread, i.undone, i.undoPending]),
    ).toEqual([
      ["ab12", true, undefined],
      ["cd34", undefined, true],
      [undefined, undefined, undefined],
    ]);
    expect(report?.filed[2].undoError).toBe("Message is no longer in Spam.");
    expect(cleanReport(null)).toBeNull();
  });

  it("describes deferred assessment retries without treating them as a mailbox error", () => {
    expect(deferredRetryNote({})).toBeNull();
    expect(deferredRetryNote({ deferred_threads: 1 })).toBe(
      "1 conversation will be tried again.",
    );
    expect(deferredRetryNote({ deferred_threads: 3 })).toBe(
      "3 conversations will be tried again.",
    );
  });

  it("reads a compact clean report from coverage", () => {
    expect(mailboxCleanReport({})).toBeNull();
    expect(
      mailboxCleanReport({
        clean: {
          at: "2026-11-25T18:00:00Z",
          reviewed: 3,
          remaining: 67,
          filed: [
            {
              subject: "Weekly digest",
              from: "news@example.com",
              folder: "Newsletter",
            },
          ],
          waiting: [{ title: "Bank login", waitingOn: "Client" }],
          needsYou: [{ title: "Fee question", nextAction: "Review draft" }],
          skipped: [{ subject: "From a client", reason: "known contact" }],
        },
      }),
    ).toEqual({
      preview: false,
      cancelled: false,
      at: "2026-11-25T18:00:00Z",
      reviewed: 3,
      remaining: 67,
      filed: [
        {
          subject: "Weekly digest",
          from: "news@example.com",
          folder: "Newsletter",
        },
      ],
      tagged: [],
      waiting: [{ subject: "Bank login", from: "", waitingOn: "Client" }],
      needsYou: [
        {
          subject: "Fee question",
          from: "",
          nextAction: "Review draft",
        },
      ],
      skipped: [
        {
          subject: "From a client",
          from: "",
          reason: "known contact",
        },
      ],
    });
  });
  it("does not confuse offline, paused or unconfigured with an empty desk", () => {
    expect(mailboxHealth(box, now)).toBe("Listening for email");
    expect(mailboxHealth({ ...box, paused: true }, now)).toBe("Paused");
    expect(mailboxHealth(box, new Date("2026-11-25T18:02:00Z"))).toBe(
      "Worker offline",
    );
    expect(mailboxHealth({ ...box, hookSecret: null }, now)).toBe(
      "Webhook setup needed",
    );
    expect(mailboxHealth({ ...box, lastError: "Cannot read Sent" }, now)).toBe(
      "Needs attention",
    );
  });
  it("counts messages independently from action attempts and requests", () => {
    const counts = activityCounts([
      { kind: "reviewed", messageKey: "m1", eventKey: "attempt1" },
      { kind: "reviewed", messageKey: "m1", eventKey: "attempt2" },
      { kind: "tagged", messageKey: "m1", eventKey: "tag1" },
      { kind: "tagged", messageKey: "m1", eventKey: "tag2" },
      { kind: "filed", messageKey: "m1", eventKey: "move1" },
      {
        kind: "completed",
        messageKey: "m1",
        requestId: "r1",
        eventKey: "done1",
      },
      {
        kind: "completed",
        messageKey: "m2",
        requestId: "r1",
        eventKey: "done2",
      },
    ]);
    expect(counts).toMatchObject({
      reviewed: 1,
      tagged: 1,
      filed: 1,
      completed: 1,
      handled: 0,
      spam: 0,
    });
  });
});

describe("request lifecycle evidence", () => {
  const request = {
    sourceKey: "thread:request",
    sourceVersion: "hash",
    baseVersion: null,
    title: "Please correct my report",
    person: "Client",
    category: "client",
    owner: "Client delivery",
    state: "working",
    urgent: false,
    summary: "Correction requested",
    recommendation: "Prepare the correction",
    nextAction: "Correct report",
    evidence: [
      {
        key: "m1",
        from: "client@example.com",
        subject: "Report",
        at: "2026-11-25T17:00:00Z",
        excerpt: "Please correct it",
        folder: "INBOX",
        attachments: [],
      },
    ],
    draft: null,
    firstReceivedAt: "2026-11-25T17:00:00Z",
    dueAt: null,
    followUpAt: null,
    waitingOn: null,
    answeredAt: "2026-11-25T18:00:00Z",
    completionNote: null,
  };
  it("allows answered work to remain unfinished", () =>
    expect(requestSchema.safeParse(request).success).toBe(true));
  it("rejects completion without evidence", () =>
    expect(
      requestSchema.safeParse({ ...request, state: "handled" }).success,
    ).toBe(false));
  it("requires a waiting party AND follow-up date", () => {
    expect(
      requestSchema.safeParse({
        ...request,
        state: "waiting",
        waitingOn: "Client",
      }).success,
    ).toBe(false);
    expect(
      requestSchema.safeParse({
        ...request,
        state: "waiting",
        waitingOn: "Client",
        followUpAt: "2026-11-27T15:00:00Z",
      }).success,
    ).toBe(true);
  });
});

describe("firm-time scorecard periods", () => {
  it("uses Central midnight instead of UTC midnight", () => {
    expect(
      activityPeriod(
        "today",
        new Date("2026-11-26T02:00:00Z"),
      ).start.toISOString(),
    ).toBe("2026-11-25T06:00:00.000Z");
  });
  it("starts weeks on Monday and respects daylight saving", () => {
    expect(
      activityPeriod(
        "week",
        new Date("2026-11-01T20:00:00Z"),
      ).start.toISOString(),
    ).toBe("2026-10-26T05:00:00.000Z");
  });
});

describe("steps", () => {
  const t = (n: number) => n.toString(16).padStart(8, "0");
  it("treats only a bucket sort without a plan as step 1", () => {
    expect(cleanIsSort({ preview: true, buckets: true, limit: 25 })).toBe(true);
    expect(cleanIsSort({ buckets: true, plan: [], previewJobId: "p" })).toBe(
      false,
    );
    expect(cleanIsSort({ manual: true })).toBe(false);
  });

  it("works in steps unless Tom turns it off", () => {
    expect(donnaSettings({}).steps).toBe(true);
    expect(donnaSettings({ inboxZero: true }).steps).toBe(true);
    expect(donnaSettings({ steps: false }).steps).toBe(false);
  });

  it("groups sorted emails into buckets, important ones first", () => {
    const buckets = cleanBuckets({
      sorted: [
        {
          thread: t(1),
          subject: "Sale",
          bucket: "Newsletter",
          suggest: "Newsletter",
          why: "Promo",
        },
        {
          thread: t(2),
          subject: "FINAL Notice",
          bucket: "Money and legal",
          suggest: null,
          why: "Money",
        },
        {
          thread: t(3),
          subject: "Update",
          bucket: "Clients",
          client: "Rodan",
          why: "Client",
        },
        {
          thread: t(4),
          subject: "Sale 2",
          bucket: "Newsletter",
          suggest: "Newsletter",
        },
        { thread: "not-hex!", subject: "Bad", bucket: "Clients" },
        { thread: t(5), subject: "Odd", bucket: "Spam", suggest: "Trash" },
      ],
    });
    expect(buckets.map((b) => [b.name, b.items.length, b.suggest])).toEqual([
      ["Money and legal", 1, null],
      ["Clients", 1, null],
      ["Newsletter", 2, "Newsletter"],
      ["Spam", 1, null],
    ]);
    expect(buckets[1].items[0].client).toBe("Rodan");
  });
});
