import { describe, expect, it } from "vitest";
import {
  MAX_ITEMS_PER_SECTION,
  SECTIONS,
  budgetTotals,
  documentWarnings,
  documentsReady,
  emptyPlan,
  airbnbSearchUrl,
  formatHours,
  spotsFor,
  hasPhotos,
  optionTotal,
  sortOptions,
  tripDays,
  itemsWithoutPin,
  mapPins,
  pinFor,
  visibleFields,
  itemsWithoutPhoto,
  moveItem,
  parseItem,
  parsePlan,
  removeItem,
  slugify,
  uniqueSlug,
  upsertItem,
} from "./plan";
import { remoteMonthsPlan } from "./starter";
import { SHAKE_RECIPE, standingNeeds } from "./needs";

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

  it("keeps photo links to https pages and lists items still missing one", () => {
    expect(() => parseItem("options", { id: id(1), place: "A", photo: "data:image/png;base64,AAAA" })).toThrow();
    let plan = emptyPlan();
    plan = upsertItem(plan, "options", parseItem("options", { id: id(1), place: "A", photo: "https://upload.wikimedia.org/a.jpg" }));
    plan = upsertItem(plan, "options", parseItem("options", { id: id(2), place: "B" }));
    expect(itemsWithoutPhoto(plan, "options").map((item) => item.place)).toEqual(["B"]);
    expect(hasPhotos("stays")).toBe(true);
    expect(hasPhotos("budget")).toBe(false);
    expect(itemsWithoutPhoto(plan, "budget")).toEqual([]);
  });

  it("starts every trip's needs from the standing list", () => {
    let n = 0;
    const needs = standingNeeds(() => id(++n));
    expect(needs.map((item) => item.need)).toEqual([
      "Gym with Olympic lifting",
      "Protein shakes, 2 a day",
      "BJJ or Muay Thai",
      "Fast, reliable internet",
      "Guitar and blues gigs",
    ]);
    expect(needs[1].plan).toBe(SHAKE_RECIPE);
    expect(needs.every((item) => item.covered === false && item.cost === null)).toBe(true);
  });

  it("puts located options, stays and places on the map", () => {
    let plan = emptyPlan();
    plan = upsertItem(plan, "options", parseItem("options", { id: id(1), place: "Mexico City", lat: 19.43, lng: -99.13 }));
    plan = upsertItem(plan, "stays", parseItem("stays", { id: id(2), name: "Flat" }));
    plan = upsertItem(plan, "budget", parseItem("budget", { id: id(3), item: "Food", lat: 1, lng: 1 }));
    expect(mapPins(plan)).toEqual([{ section: "options", id: id(1), name: "Mexico City", lat: 19.43, lng: -99.13, photo: null }]);
    expect(itemsWithoutPin(plan, "stays").map((item) => item.id)).toEqual([id(2)]);
    expect(itemsWithoutPin(plan, "budget")).toEqual([]);
    expect(pinFor("budget", plan.sections.budget[0])).toBeNull();
    expect(() => parseItem("places", { id: id(4), name: "X", lat: 500, lng: 0 })).toThrow();
  });

  it("keeps coordinates out of forms and points every card summary at a real field", () => {
    for (const section of SECTIONS) {
      expect(visibleFields(section).some((field) => field.type === "coordinate")).toBe(false);
      for (const key of section.summary) {
        expect(section.fields.map((field) => field.key), `${section.key}.${key}`).toContain(key);
      }
    }
  });

  it("totals an option for the trip length and reads that length from dates or the plan", () => {
    const plan = { ...emptyPlan(), days: 60 };
    expect(tripDays(plan, { startsOn: "", endsOn: "" })).toBe(60);
    expect(tripDays(plan, { startsOn: "2027-01-05", endsOn: "2027-03-05" })).toBe(60);
    expect(tripDays(plan, { startsOn: "2027-01-05", endsOn: "" })).toBe(60);
    expect(parsePlan({ days: 0 }).days).toBe(30);
    const option = parseItem("options", { id: id(1), place: "Mexico City", roundTrip: 214, monthly: 1500 });
    expect(optionTotal(option, 60)).toBe(3214);
    expect(optionTotal(option, 45)).toBe(2464);
    expect(optionTotal(parseItem("options", { id: id(2), place: "X" }), 60)).toBeNull();
  });

  it("sorts options by total or by closeness to Conroe time, missing values last", () => {
    const opt = (n: number, place: string, roundTrip: number | null, monthly: number | null, hoursAhead: number | null) =>
      parseItem("options", { id: id(n), place, roundTrip, monthly, hoursAhead });
    const items = [
      opt(1, "Fukuoka", 809, 1400, 15),
      opt(2, "Mexico City", 214, 1500, 0),
      opt(3, "Unknown", null, null, null),
      opt(4, "Merida", 300, 1200, 0),
      opt(5, "Medellin", 492, 1200, 1),
    ];
    const names = (sort: "mine" | "total" | "time") => sortOptions(items, sort, 60).map((item) => item.place);
    expect(names("mine")).toEqual(["Fukuoka", "Mexico City", "Unknown", "Merida", "Medellin"]);
    expect(names("total")).toEqual(["Merida", "Medellin", "Mexico City", "Fukuoka", "Unknown"]);
    expect(names("time")).toEqual(["Merida", "Mexico City", "Medellin", "Fukuoka", "Unknown"]);
    expect(formatHours(0)).toBe("Same time");
    expect(formatHours(-1)).toBe("1 hour behind");
    expect(formatHours(15)).toBe("15 hours ahead");
  });

  it("groups an option's spots by kind and links Airbnb monthly searches", () => {
    let plan = emptyPlan();
    const spot = (n: number, name: string, kind: string, option: string) =>
      (plan = upsertItem(plan, "spots", parseItem("spots", { id: id(n), name, kind, option })));
    spot(1, "Café Toscano", "Work spot", "Mexico City");
    spot(2, "Roma Norte", "Neighborhood to stay", "mexico city");
    spot(3, "Metro", "Getting around", "Mexico City");
    spot(4, "Nimman", "Neighborhood to stay", "Chiang Mai, Thailand");
    spot(5, "Mystery", "", "Mexico City");
    expect(spotsFor(plan, "Mexico City").map((group) => [group.kind, group.spots.map((item) => item.name)])).toEqual([
      ["Neighborhood to stay", ["Roma Norte"]],
      ["Work spot", ["Café Toscano"]],
      ["Getting around", ["Metro"]],
      ["Other", ["Mystery"]],
    ]);
    expect(itemsWithoutPin(plan, "spots").map((item) => item.name)).not.toContain("Metro");
    expect(airbnbSearchUrl("Roma Norte, Mexico City")).toBe("https://www.airbnb.com/s/Roma-Norte--Mexico-City/homes?monthly_stay=true");
    expect(airbnbSearchUrl("Mérida, Mexico")).toBe("https://www.airbnb.com/s/M%C3%A9rida--Mexico/homes?monthly_stay=true");
  });
});
