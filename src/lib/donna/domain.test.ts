import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  activityCounts,
  mailboxHealth,
  coverageLabel,
  mailboxFolders,
  mailboxFolderTables,
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
