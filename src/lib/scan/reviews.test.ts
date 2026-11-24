import { describe, expect, it } from "vitest";
import {
  answersFor,
  newsletterDefault,
  parseApplied,
  parseReviewList,
  saveAnswers,
  syncReviewList,
  type NewsletterRow,
} from "./reviews";

type Row = { id: string; review: string; itemKey: string; status: string; data?: unknown; answer?: string | null };

/** In-memory stand-in for prisma.scanReviewItem, enough for these helpers. */
function fakeDb(rows: Row[]) {
  let n = rows.length;
  const match = (row: Row, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, want]) => {
      const value = (row as Record<string, unknown>)[key];
      if (want && typeof want === "object" && "in" in (want as object)) return (want as { in: unknown[] }).in.includes(value);
      return value === want;
    });
  const scanReviewItem = {
    findMany: async ({ where }: { where: Record<string, unknown> }) => rows.filter((row) => match(row, where)),
    update: async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
      const row = rows.find((r) => r.id === where.id)!;
      Object.assign(row, data);
      return row;
    },
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<Row> }) => {
      const hit = rows.filter((row) => match(row, where));
      hit.forEach((row) => Object.assign(row, data));
      return { count: hit.length };
    },
    createMany: async ({ data }: { data: Row[] }) => {
      data.forEach((row) => rows.push({ ...row, id: `new${++n}`, status: "pending" }));
      return { count: data.length };
    },
  };
  return { rows, db: { scanReviewItem } as never };
}

const news = (addr: string, extra: Partial<NewsletterRow> = {}) => ({
  addr, name: null, count: 3, date: null, subjects: ["Hi"], suggest: null, protected: false, reply: false, ...extra,
});

describe("parseReviewList", () => {
  it("keeps valid spam rows keyed by ledger number and drops bad ones", () => {
    const items = parseReviewList("spam", [
      { number: 7, from: "a@x.com", subject: "Win", why: "promo" },
      { number: "8", from: "b@x.com" },
      { number: 9 },
      { number: 7, from: "dup@x.com" },
    ]);
    expect(items?.map((i) => i.itemKey)).toEqual(["7"]);
  });

  it("lowercases newsletter addresses and refuses commas", () => {
    const items = parseReviewList("newsletter", [news("News@X.com"), news("a@x.com,b@y.com"), { addr: "c@x.com" }]);
    expect(items?.map((i) => i.itemKey)).toEqual(["news@x.com"]);
  });

  it("returns null when the list is missing, so nothing is marked gone", () => {
    expect(parseReviewList("spam", undefined)).toBeNull();
  });
});

describe("syncReviewList", () => {
  it("creates new rows, reopens applied ones still listed, marks unlisted pending rows gone", async () => {
    const { rows, db } = fakeDb([
      { id: "a", review: "newsletter", itemKey: "a@x.com", status: "applied" },
      { id: "b", review: "newsletter", itemKey: "b@x.com", status: "pending" },
      { id: "c", review: "newsletter", itemKey: "c@x.com", status: "answered" },
      { id: "s", review: "spam", itemKey: "1", status: "pending" },
    ]);
    const items = parseReviewList("newsletter", [news("a@x.com"), news("d@x.com")])!;
    const result = await syncReviewList(db, "newsletter", items);
    expect(result).toEqual({ created: 1, reopened: 1, gone: 1 });
    const status = Object.fromEntries(rows.map((r) => [r.itemKey, r.status]));
    expect(status).toEqual({ "a@x.com": "pending", "b@x.com": "gone", "c@x.com": "answered", "1": "pending", "d@x.com": "pending" });
  });
});

describe("answers", () => {
  it("newsletter default keeps receipts, never-block senders and replies", () => {
    expect(newsletterDefault(news("a@x.com", { suggest: "subject: Receipt" }))).toBe("keep");
    expect(newsletterDefault(news("a@x.com", { protected: true }))).toBe("keep");
    expect(newsletterDefault(news("a@x.com", { reply: true }))).toBe("keep");
    expect(newsletterDefault(news("a@x.com"))).toBe("clear");
  });

  it("flips only tapped rows", () => {
    expect(answersFor("spam", [{ id: "1", defaultAnswer: "spam" }, { id: "2", defaultAnswer: "spam" }], new Set(["2"])))
      .toEqual([{ id: "1", answer: "spam" }, { id: "2", answer: "not-spam" }]);
    expect(answersFor("newsletter", [{ id: "1", defaultAnswer: "keep" }], new Set(["1"]))).toEqual([{ id: "1", answer: "clear" }]);
  });

  it("saves answers on pending rows only and refuses unknown answers", async () => {
    const { rows, db } = fakeDb([
      { id: "1", review: "spam", itemKey: "1", status: "pending" },
      { id: "2", review: "spam", itemKey: "2", status: "gone" },
    ]);
    const saved = await saveAnswers(db, "spam", [{ id: "1", answer: "spam" }, { id: "2", answer: "not-spam" }], "tom");
    expect(saved).toBe(1);
    expect(rows.map((r) => [r.status, r.answer ?? null])).toEqual([["answered", "spam"], ["gone", null]]);
    await expect(saveAnswers(db, "spam", [{ id: "1", answer: "keep" }], "tom")).rejects.toThrow();
  });

  it("parseApplied wants id and ok on every row", () => {
    expect(parseApplied([{ id: "1", ok: true, result: "done" }])).toEqual([{ id: "1", ok: true, result: "done" }]);
    expect(parseApplied([{ id: "1" }])).toBeNull();
    expect(parseApplied("x")).toBeNull();
  });
});
