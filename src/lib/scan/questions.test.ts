import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ tag: vi.fn(), finding: vi.fn() }));
vi.mock("@/lib/pipe/tags", () => ({ applyPipeTag: mocks.tag }));
vi.mock("@/lib/scanner/post", () => ({ postScanFinding: mocks.finding }));

import type { PrismaClient } from "@prisma/client";
const questions = await import("./questions");
const { answerQuestion, proposeBroaderRules, syncQuestions, undoQuestion } = questions;
const asDb = (fake: unknown) => fake as unknown as PrismaClient;

const db = (overrides: Record<string, unknown> = {}) => ({
  scanQuestion: {
    findUnique: vi.fn(async () => null),
    findMany: vi.fn(async () => []),
    findFirst: vi.fn(async () => null),
    count: vi.fn(async () => 0),
    create: vi.fn(async (args: unknown) => ({ id: "q-new", ...(args as { data: object }).data })),
    update: vi.fn(async () => ({})),
  },
  scanRule: {
    findMany: vi.fn(async () => []),
    findFirst: vi.fn(async () => null),
    create: vi.fn(async (args: unknown) => ({ id: "rule-1", ...(args as { data: object }).data })),
    update: vi.fn(async () => ({})),
  },
  scanFinding: { findUnique: vi.fn(async () => null), findMany: vi.fn(async () => []) },
  lead: { findFirst: vi.fn(async () => null), findUnique: vi.fn(async () => null), create: vi.fn(async () => ({ id: "l1" })), update: vi.fn(async () => ({})) },
  contact: { findFirst: vi.fn(async () => null), create: vi.fn(async () => ({ id: "c1" })), delete: vi.fn(async () => ({})), findUnique: vi.fn(async () => null) },
  brand: { findUnique: vi.fn(async () => ({ slug: "bookkeeping-conroe" })) },
  leadContact: { findMany: vi.fn(async () => []), count: vi.fn(async () => 0) },
  contactTagLink: { count: vi.fn(async () => 0) },
  pipeline: { findFirst: vi.fn(async () => null) },
  pipelineStage: { findMany: vi.fn(async () => []) },
  pipelineItem: { updateMany: vi.fn(async () => ({ count: 0 })) },
  engagement: { findMany: vi.fn(async () => []) },
  ...overrides,
});

beforeEach(() => {
  mocks.tag.mockReset().mockResolvedValue({ changed: true });
  mocks.finding.mockReset().mockResolvedValue({ created: true });
});

describe("answerQuestion", () => {
  it("creates a lead and a rule for sms-lead", async () => {
    const fake = db({
      scanQuestion: {
        findUnique: vi.fn(async (args: unknown) => {
          const where = (args as { where?: { id?: string } }).where ?? {};
          if (where.id && where.id !== "q1") return null;
          return {
            id: "q1", brandId: "b1", kind: "sms-lead", status: "open",
            options: [{ key: "create-lead", label: "Create lead" }, { key: "ignore", label: "Ignore" }],
            ref: { number: "+15550001111", body: "Call me" }, findingId: null,
          };
        }),
        findMany: vi.fn(async () => []),
        count: vi.fn(async () => 0),
        create: vi.fn(async () => ({})),
        update: vi.fn(async () => ({})),
      },
    });
    const result = await answerQuestion(asDb(fake), "tester", "q1", "create-lead");
    expect(result.message).toMatch(/Lead created/);
  });

  it("ignores with a keep rule and no lead", async () => {
    const fake = db({
      scanQuestion: {
        findUnique: vi.fn(async (args: unknown) => {
          const where = (args as { where?: { id?: string } }).where ?? {};
          if (where.id && where.id !== "q2") return null;
          return {
            id: "q2", brandId: "b1", kind: "sms-lead", status: "open",
            options: [{ key: "create-lead", label: "Create lead" }, { key: "ignore", label: "Ignore" }],
            ref: { number: "+15550002222", body: "hi" }, findingId: null,
          };
        }),
        update: vi.fn(async () => ({})),
      },
    });
    const result = await answerQuestion(asDb(fake), "tester", "q2", "ignore");
    expect(result.message).toMatch(/Ignored/);
  });

  it("rejects unknown options and answered questions", async () => {
    const fake = db({
      scanQuestion: {
        findUnique: vi.fn(async (args: unknown) => {
          const where = (args as { where?: { id?: string } }).where ?? {};
          if (where.id !== "q3") return null;
          return { id: "q3", brandId: "b1", kind: "sms-lead", status: "answered", options: [], ref: {}, findingId: null };
        }),
        update: vi.fn(async () => ({})),
      },
    });
    await expect(answerQuestion(asDb(fake), "tester", "nope", "ignore")).rejects.toThrow("not found");
    const done = await answerQuestion(asDb(fake), "tester", "q3", "ignore");
    expect(done.message).toBe("Already answered.");
  });
});

describe("undoQuestion", () => {
  it("restores an archived lead and reopens the question", async () => {
    const fake = db({
      scanQuestion: {
        findUnique: vi.fn(async () => ({
          id: "q4", brandId: "b1", kind: "stale-lead", status: "answered",
          undo: [{ op: "lead-status", leadId: "l9", status: "NEW" }], findingId: null,
        })),
        update: vi.fn(async () => ({})),
      },
      lead: { update: vi.fn(async () => ({})) },
    });
    const result = await undoQuestion(asDb(fake), "tester", "q4");
    expect(result.message).toMatch(/Undone/);
  });
});

describe("syncQuestions", () => {
  it("turns an open stale-lead finding into a question", async () => {
    const fake = db({
      scanQuestion: {
        findUnique: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
        count: vi.fn(async () => 0),
        create: vi.fn(async (args: unknown) => ({ id: "q-new", ...(args as { data: object }).data })),
        update: vi.fn(async () => ({})),
      },
      scanFinding: {
        findMany: vi.fn(async () => [
          { id: "f1", room: "pipeline", key: "scan-tags:stale-lead:l1", what: "Stale lead Acme", severity: "normal" },
        ]),
      },
    });
    const result = await syncQuestions(asDb(fake), ["b1"]);
    expect(result.created).toBe(1);
  });
});

describe("proposeBroaderRules", () => {
  it("proposes one rule after three similar answers", async () => {
    const fake = db({
      scanRule: {
        findMany: vi.fn(async () => [
          { id: "r1", kind: "always-spam", matcher: { sender: "a@junk.example" } },
          { id: "r2", kind: "always-spam", matcher: { sender: "b@junk.example" } },
          { id: "r3", kind: "always-spam", matcher: { sender: "c@junk.example" } },
        ]),
        findFirst: vi.fn(async () => null),
        create: vi.fn(async (args: unknown) => ({ id: "rule-b", ...(args as { data: object }).data })),
        update: vi.fn(async () => ({})),
      },
      scanQuestion: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async (args: unknown) => ({ id: "q-b", ...(args as { data: object }).data })),
      },
    });
    const result = await proposeBroaderRules(asDb(fake), [{ id: "b1", slug: "bookkeeping-conroe" }]);
    expect(result.created).toBe(1);
  });

  it("never proposes for shared providers", async () => {
    const fake = db({
      scanRule: {
        findMany: vi.fn(async () => [
          { id: "r1", kind: "always-spam", matcher: { sender: "a@gmail.com" } },
          { id: "r2", kind: "always-spam", matcher: { sender: "b@gmail.com" } },
          { id: "r3", kind: "always-spam", matcher: { sender: "c@gmail.com" } },
        ]),
        findFirst: vi.fn(async () => null),
      },
      scanQuestion: { findFirst: vi.fn(async () => null) },
    });
    const result = await proposeBroaderRules(asDb(fake), [{ id: "b1", slug: "bookkeeping-conroe" }]);
    expect(result.created).toBe(0);
  });
});
