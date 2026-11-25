import { describe, expect, it } from "vitest";
import {
  MAX_ITEMS_PER_SECTION,
  SECTIONS,
  budgetTotals,
  documentWarnings,
  documentsReady,
  emptyPlan,
  moveItem,
  parseItem,
  parsePlan,
  removeItem,
  slugify,
  uniqueSlug,
  upsertItem,
} from "./plan";
import { remoteMonthsPlan } from "./starter";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("travel plan", () => {
  it("fills missing fields with blanks and drops unknown keys", () => {
    const item = parseItem("stays", { id: id(1), name: "Casa Roma", sneaky: "x" });
    expect(item).toMatchObject({ id: id(1), name: "Casa Roma", cost: null, booked: false, link: "" });
    expect(item).not.toHaveProperty("sneaky");
  });

  it("requires the heading field", () => {
    expect(() => parseItem("budget", { id: id(1), item: "  " })).toThrow(/budget line/);
  });

  it("rejects bad dates, links and choices", () => {
    expect(() => parseItem("itinerary", { id: id(1), title: "Day 1", date: "12/01/2026" })).toThrow();
    expect(() => parseItem("stays", { id: id(1), name: "A", link: "javascript:alert(1)" })).toThrow();
    expect(() => parseItem("budget", { id: id(1), item: "A", category: "Yachts" })).toThrow();
  });

  it("rounds money to cents", () => {
    expect(parseItem("budget", { id: id(1), item: "Food", planned: 10.005 }).planned).toBe(10.01);
  });

  it("reads a damaged plan without throwing and skips bad items", () => {
    const plan = parsePlan({ summary: 3, sections: { stays: [{ id: id(1), name: "Ok" }, { id: "nope" }], places: "x" } });
    expect(plan.summary).toBe("");
    expect(plan.sections.stays).toHaveLength(1);
    expect(plan.sections.places).toEqual([]);
    expect(Object.keys(plan.sections)).toHaveLength(SECTIONS.length);
  });

  it("adds, replaces, moves and removes items", () => {
    let plan = emptyPlan();
    plan = upsertItem(plan, "places", parseItem("places", { id: id(1), name: "A" }));
    plan = upsertItem(plan, "places", parseItem("places", { id: id(2), name: "B" }));
    plan = upsertItem(plan, "places", parseItem("places", { id: id(1), name: "A2" }));
    expect(plan.sections.places.map((p) => p.name)).toEqual(["A2", "B"]);
    plan = moveItem(plan, "places", id(2), -1);
    expect(plan.sections.places.map((p) => p.name)).toEqual(["B", "A2"]);
    expect(moveItem(plan, "places", id(2), -1)).toBe(plan);
    plan = removeItem(plan, "places", id(2));
    expect(plan.sections.places.map((p) => p.name)).toEqual(["A2"]);
  });

  it("caps each list", () => {
    let plan = emptyPlan();
    for (let n = 0; n < MAX_ITEMS_PER_SECTION; n += 1) {
      plan = upsertItem(plan, "places", parseItem("places", { id: id(n), name: `P${n}` }));
    }
    expect(() => upsertItem(plan, "places", parseItem("places", { id: id(9999), name: "One more" }))).toThrow(/full/);
  });

  it("totals planned, actual and booked costs", () => {
    let plan = emptyPlan();
    plan = upsertItem(plan, "budget", parseItem("budget", { id: id(1), item: "Flight", planned: 300.1, actual: 280 }));
    plan = upsertItem(plan, "budget", parseItem("budget", { id: id(2), item: "Food", planned: 600.2 }));
    plan = upsertItem(plan, "stays", parseItem("stays", { id: id(3), name: "Booked", cost: 900, booked: true }));
    plan = upsertItem(plan, "stays", parseItem("stays", { id: id(4), name: "Maybe", cost: 700 }));
    plan = upsertItem(plan, "travel", parseItem("travel", { id: id(5), route: "IAH-MEX", cost: 99.5, booked: true }));
    expect(budgetTotals(plan)).toEqual({ planned: 900.3, actual: 280, booked: 999.5 });
  });

  it("makes readable unique slugs", () => {
    expect(slugify("Mérida, Mexico — 60 days!")).toBe("merida-mexico-60-days");
    expect(slugify("!!!")).toBe("trip");
    expect(uniqueSlug("japan", new Set(["japan", "japan-2"]))).toBe("japan-3");
  });

  it("builds the starter trip from valid items", () => {
    const plan = remoteMonthsPlan();
    expect(plan.sections.options.map((o) => o.place)).toHaveLength(5);
    expect(plan.sections.documents[0]).toMatchObject({ document: "US passport", status: "Need it" });
    expect(parsePlan(JSON.parse(JSON.stringify(plan)))).toEqual(plan);
  });

  it("counts ready documents and warns about expiry", () => {
    let plan = emptyPlan();
    const add = (n: number, fields: Record<string, unknown>) => {
      plan = upsertItem(plan, "documents", parseItem("documents", { id: id(n), ...fields }));
    };
    add(1, { document: "Passport", who: "Tom", status: "Have it", expires: "2026-07-06" });
    add(2, { document: "Visa", status: "Have it", expires: "2027-02-01" });
    add(3, { document: "Tourist card", status: "Not needed", expires: "2020-01-01" });
    add(4, { document: "Insurance", status: "Applied", expires: "2028-01-01" });
    expect(documentsReady(plan)).toEqual({ ready: 3, total: 4 });
    expect(documentWarnings(plan, { startsOn: "2027-01-05", endsOn: "2027-03-05" }, "2026-11-25")).toEqual([
      "Passport (Tom) expired on 2026-07-06.",
      "Visa expires 2027-02-01, before the trip ends on 2027-03-05.",
    ]);
    expect(documentWarnings(plan, { startsOn: "", endsOn: "" }, "2026-11-25")).toEqual(["Passport (Tom) expired on 2026-07-06."]);
  });

  it("rejects an unknown document status", () => {
    expect(() => parseItem("documents", { id: id(1), document: "Visa", status: "Maybe" })).toThrow();
  });
});
