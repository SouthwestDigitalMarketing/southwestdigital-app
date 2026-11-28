import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { NAV_DESTINATIONS } from "@/lib/keyboard/commands";
import {
  CHECK_ITEMS, MAX_ITEMS, STATUSES, cashNeeded, changePlan, costTotals,
  emptyPlan, formatMoney, parseItem, parsePlan, sortedCandidates,
} from "./plan";
import { starterPlan } from "./starter";

function van(overrides: Record<string, unknown> = {}) {
  return parseItem("candidates", { id: randomUUID(), make: "Ram", model: "ProMaster", ...overrides });
}

describe("price-based Texas cash estimate", () => {
  it.each([
    [44000, 2750, 46783], [45000, 2812.5, 47845.5], [49990, 3124.38, 53147.38],
    [32995, 2062.19, 35090.19], [30500, 1906.25, 32439.25],
    [0, 0, 33], [0.08, 0.01, 33.09], [100.01, 6.25, 139.26],
  ])("price %s → tax %s and total %s", (price, tax, total) => {
    expect(cashNeeded(price)).toEqual({ price, tax, title: 33, total });
  });
  it("leaves an unknown price unknown", () => expect(cashNeeded(null)).toBeNull());
  it.each([-1, NaN, Infinity, 10_000_000])("rejects invalid price %s", (price) => expect(() => cashNeeded(price)).toThrow());
});

describe("van lists", () => {
  it("fills missing lists and skips corrupt entries", () => {
    const valid = van();
    expect(parsePlan({ sections: { candidates: [valid, { ...valid, status: "unknown" }, null] } }))
      .toEqual({ sections: { candidates: [valid], needs: [], costs: [] } });
    expect(parsePlan(null)).toEqual(emptyPlan());
  });
  it("drops unknown keys and defaults new candidates to Watching with blank numbers", () => {
    const item = van({ secret: "drop" });
    expect(item).not.toHaveProperty("secret");
    expect(item.status).toBe("Watching");
    expect(item.price).toBeNull();
    expect(item.batteryAh).toBeNull();
    expect(item.inspector).toBe(false);
  });
  it.each([
    { price: -1 }, { price: NaN }, { miles: 1.5 }, { year: 1800 }, { year: 2026.5 },
    { solarW: -300 }, { inverterW: Infinity }, { make: "" }, { model: " " }, { status: "Contacted" },
    { link: "javascript:alert(1)" }, { link: "https://bad link.example" }, { inspector: "true" },
  ])("rejects bad candidate fields %j", (fields) => expect(() => van(fields)).toThrow());
  it("accepts only http(s) listing links", () => {
    expect(van({ link: "https://example.com/van?year=2018" }).link).toBe("https://example.com/van?year=2018");
    expect(() => van({ link: "mailto:seller@example.com" })).toThrow();
  });
  it("sorts in the requested status order, then ascending price, unknown last", () => {
    const items = [...STATUSES].reverse().flatMap((status) => [van({ status, price: null }), van({ status, price: 50000 }), van({ status, price: 30000 })]);
    const sorted = sortedCandidates(items);
    expect(sorted.map((item) => item.status)).toEqual(STATUSES.flatMap((status) => [status, status, status]));
    expect(sorted.slice(0, 3).map((item) => item.price)).toEqual([30000, 50000, null]);
    expect(items[0].status).toBe("Bought");
  });
  it("keeps candidate checklists separate through edits and status changes", () => {
    const first = van(), second = van();
    let plan = { sections: { ...emptyPlan().sections, candidates: [first, second] } };
    plan = changePlan(plan, { kind: "check", id: first.id, key: "inspector", done: true });
    plan = changePlan(plan, { kind: "check", id: first.id, key: "coldStart", done: true });
    plan = changePlan(plan, { kind: "save", section: "candidates", item: { ...first, price: 40000 } });
    plan = changePlan(plan, { kind: "status", id: first.id, status: "Inspected" });
    expect(plan.sections.candidates[0]).toMatchObject({ inspector: true, coldStart: true, price: 40000, status: "Inspected" });
    expect(plan.sections.candidates[1]).toEqual(second);
    expect(parsePlan(JSON.parse(JSON.stringify(plan)))).toEqual(plan);
    plan = changePlan(plan, { kind: "check", id: first.id, key: "inspector", done: false });
    expect(plan.sections.candidates[0].inspector).toBe(false);
    expect(plan.sections.candidates[0].coldStart).toBe(true);
  });
  it("adds, edits and removes needs / costs without mutating the source", () => {
    const original = emptyPlan();
    const id = randomUUID();
    const added = changePlan(original, { kind: "save", section: "costs", item: { id, name: "Insurance", amount: null } });
    expect(original.sections.costs).toHaveLength(0);
    const edited = changePlan(added, { kind: "save", section: "costs", item: { id, name: "Insurance, first year", amount: 1200 } });
    expect(edited.sections.costs).toHaveLength(1);
    expect(edited.sections.costs[0].amount).toBe(1200);
    expect(changePlan(edited, { kind: "remove", section: "costs", id }).sections.costs).toEqual([]);
    const needs = changePlan(original, { kind: "save", section: "needs", item: { id, name: "Heat" } });
    expect(needs.sections.needs[0].name).toBe("Heat");
  });
  it("removes only the selected candidate and its checklist", () => {
    const plan = starterPlan();
    const removed = changePlan(plan, { kind: "remove", section: "candidates", id: plan.sections.candidates[0].id });
    expect(removed.sections.candidates).toEqual(plan.sections.candidates.slice(1));
    expect(removed.sections.needs).toEqual(plan.sections.needs);
  });
  it("rejects made-up actions, lists, checklist keys and missing vans", () => {
    expect(() => changePlan(emptyPlan(), { kind: "reset" })).toThrow();
    expect(() => changePlan(emptyPlan(), { kind: "save", section: "other", item: {} })).toThrow();
    expect(() => changePlan(emptyPlan(), { kind: "check", id: randomUUID(), key: "price", done: true })).toThrow();
    expect(() => changePlan(emptyPlan(), { kind: "status", id: randomUUID(), status: "Bought" })).toThrow("no longer exists");
  });
  it("caps list growth but permits edits in a full list", () => {
    const items = Array.from({ length: MAX_ITEMS }, () => parseItem("needs", { id: randomUUID(), name: "Need" }));
    const plan = { sections: { ...emptyPlan().sections, needs: items } };
    expect(() => changePlan(plan, { kind: "save", section: "needs", item: { id: randomUUID(), name: "Extra" } })).toThrow("full");
    expect(changePlan(plan, { kind: "save", section: "needs", item: { ...items[0], name: "Edited" } }).sections.needs).toHaveLength(MAX_ITEMS);
  });
  it("totals quoted cents, preserves zero and counts blank amounts", () => {
    const costs = [0.1, 0.2, 0, null].map((amount) => parseItem("costs", { id: randomUUID(), name: "Cost", amount }));
    expect(costTotals(costs)).toEqual({ total: 0.3, unquoted: 1 });
    expect(costTotals([])).toEqual({ total: 0, unquoted: 0 });
    expect(() => parseItem("costs", { id: randomUUID(), name: "Cost", amount: -1 })).toThrow();
  });
});

describe("Donna shortlist", () => {
  it("seeds all five vans, six needs and five unquoted costs with fresh IDs", () => {
    const plan = starterPlan();
    expect(plan.sections.candidates).toHaveLength(5);
    expect(plan.sections.needs).toHaveLength(6);
    expect(plan.sections.costs).toHaveLength(5);
    expect(plan.sections.candidates.map((item) => item.price)).toEqual([44000, 49990, 45000, 32995, 30500]);
    expect(plan.sections.candidates.every((item) => item.status === "Watching")).toBe(true);
    const checks = CHECK_ITEMS;
    expect(checks).toHaveLength(16);
    expect(plan.sections.candidates.every((item) => checks.every((check) => item[check.key] === false))).toBe(true);
    expect(costTotals(plan.sections.costs)).toEqual({ total: 0, unquoted: 5 });
    expect(starterPlan().sections.candidates[0].id).not.toBe(plan.sections.candidates[0].id);
  });
  it("keeps unlisted power / bathroom details unknown and VA distinct from W", () => {
    const [ram, sprinter, overland, excel, wayfarer] = starterPlan().sections.candidates;
    expect(ram).toMatchObject({ batteryAh: 400, solarW: 300, inverterW: 1000 });
    expect(sprinter).toMatchObject({ batteryAh: null, solarW: null, inverterW: 3000 });
    expect(sprinter.notes).toContain("Sink filter leak");
    expect(overland.inverterW).toBeNull();
    expect(overland.power).toContain("2000VA");
    expect(overland.notes).toContain("rebuilt engine");
    expect(excel.bathroom).toBe("");
    expect(excel.contact).toContain("713-234-1176");
    expect(wayfarer.solarW).toBeNull();
    expect(wayfarer.power).toContain("800W");
  });
  it("can start empty without losing needs and cost prompts", () => {
    const plan = starterPlan(false);
    expect(plan.sections.candidates).toEqual([]);
    expect(plan.sections.needs).toHaveLength(6);
    expect(plan.sections.costs).toHaveLength(5);
  });
  it("assigns Van an unused g v command", () => {
    const commands = NAV_DESTINATIONS.filter((command) => command.keys === "g v");
    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({ id: "nav.van", title: "Van", aliases: expect.arrayContaining(["van"]) });
  });
});

describe("formatMoney", () => {
  it("shows whole dollars without cents and partial dollars with two digits", () => {
    expect(formatMoney(45000)).toBe("$45,000");
    expect(formatMoney(47845.5)).toBe("$47,845.50");
    expect(formatMoney(2812.5)).toBe("$2,812.50");
  });
});
