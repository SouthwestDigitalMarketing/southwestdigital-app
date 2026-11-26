import { describe, expect, it } from "vitest";
import { emptyPlan, needsJapanSwitch, parseItem, type SectionKey, type TripPlan } from "./plan";
import { switchToJapan } from "./starter";

let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const add = (plan: TripPlan, key: SectionKey, fields: Record<string, unknown>) => {
  plan.sections[key].push(parseItem(key, { id: id(), ...fields }));
};

function oldTrip(): TripPlan {
  const plan = { ...emptyPlan(), days: 60, summary: "Bag, laptop and phone. A cheap long stay with good Wi-Fi..." };
  for (const place of ["Mexico City", "Mérida, Mexico", "Medellín, Colombia", "Fukuoka, Japan", "Chiang Mai, Thailand"]) {
    add(plan, "options", { place, notes: place === "Fukuoka, Japan" ? "Tom's own note" : "" });
  }
  add(plan, "spots", { name: "Blend Station", kind: "Work spot", option: "Mexico City" });
  add(plan, "spots", { name: "My ramen place", kind: "Other", option: "Fukuoka, Japan" });
  add(plan, "budget", { item: "Round trip flight", category: "Getting there" });
  add(plan, "budget", { item: "Passport renewal", category: "Fees and documents", planned: 130 });
  add(plan, "budget", { item: "Travel insurance", category: "Insurance", actual: 48 });
  add(plan, "budget", { item: "New laptop bag", category: "Gear", planned: 60 });
  add(plan, "documents", { document: "US passport", status: "Applied" });
  add(plan, "documents", { document: "Arrival form for the place we pick", status: "Need it" });
  add(plan, "entry", { rule: "Remote work on a tourist entry", detail: "A gray area everywhere on the list." });
  add(plan, "entry", { rule: "Passport validity", detail: "Thailand wants 6 months left on the passport." });
  add(plan, "entry", { rule: "My own rule", detail: "Keep this." });
  add(plan, "needs", { need: "Gym with Olympic lifting", covered: true });
  add(plan, "home", { task: "Mail: hold or forward", done: true });
  return plan;
}

describe("switchToJapan", () => {
  it("keeps Tom's things and drops the other places", () => {
    const before = oldTrip();
    expect(needsJapanSwitch(before, "")).toBe(true);
    const after = switchToJapan(before);

    expect(after.sections.options.map((o) => o.place)).toEqual(["Japan: Tokyo, Kyoto & Osaka"]);
    expect(after.sections.spots).toEqual([]); // earlier places' spots, Fukuoka included, go
    expect(after.summary).toMatch(/^Bag, laptop and phone\. About 6 weeks based in Tokyo/);
    expect(after.sections.itinerary).toHaveLength(2);
    expect(after.sections.travel.map((leg) => leg.route)).toContain("Tokyo to Kyoto");

    const budget = Object.fromEntries(after.sections.budget.map((line) => [line.item, [line.planned, line.actual]]));
    expect(budget["Round trip flight"]).toEqual([1036, null]);
    expect(budget["Travel insurance"]).toEqual([null, 48]); // money already spent is kept as is
    expect(budget["New laptop bag"]).toEqual([60, null]); // his own line
    expect(after.sections.budget.filter((line) => line.item === "Passport renewal")).toHaveLength(1);

    expect(after.sections.documents.map((d) => [d.document, d.status])).toEqual([
      ["US passport", "Applied"],
      ["Visit Japan Web", "Need it"],
    ]);
    expect(after.sections.entry.map((r) => r.rule)).toEqual(["90 days visa-free", "Remote work on a tourist entry", "My own rule"]);
    expect(after.sections.entry.find((r) => r.rule === "Remote work on a tourist entry")?.detail).toMatch(/Unclear in Japan/);
    expect(after.sections.needs[0].covered).toBe(true);
    expect(after.sections.home[0].done).toBe(true);
    expect(needsJapanSwitch(after, "Japan: Tokyo, Kyoto & Osaka")).toBe(false);
  });

  it("is safe to run twice and leaves a written summary alone", () => {
    const once = switchToJapan({ ...oldTrip(), summary: "My own words" });
    expect(once.summary).toBe("My own words");
    const twice = switchToJapan(once);
    expect(twice.sections.budget.map((l) => l.item)).toEqual(once.sections.budget.map((l) => l.item));
    expect(twice.sections.documents.map((d) => d.document)).toEqual(once.sections.documents.map((d) => d.document));
    expect(twice.sections.entry.map((r) => r.rule)).toEqual(once.sections.entry.map((r) => r.rule));
  });

  it("moves a Fukuoka-plan trip onto Tokyo", () => {
    const fukuoka = { ...emptyPlan(), days: 60, summary: "Bag, laptop and phone. Two months in Fukuoka with good Wi-Fi..." };
    add(fukuoka, "options", { place: "Fukuoka, Japan" });
    add(fukuoka, "spots", { name: "CrossFit Hakata", kind: "Gym", option: "Fukuoka, Japan" });
    add(fukuoka, "budget", { item: "CrossFit Hakata, 2 months", category: "Other", planned: 440 });
    add(fukuoka, "budget", { item: "Living, 60 days (rent, food, transit)", category: "Lodging", planned: 2800 });
    add(fukuoka, "itinerary", { title: "My own day", date: "2027-01-20" });
    expect(needsJapanSwitch(fukuoka, "Fukuoka, Japan")).toBe(true);
    const after = switchToJapan(fukuoka);
    expect(after.sections.options.map((o) => o.place)).toEqual(["Japan: Tokyo, Kyoto & Osaka"]);
    expect(after.sections.spots).toEqual([]);
    const items = after.sections.budget.map((line) => line.item);
    expect(items).not.toContain("CrossFit Hakata, 2 months");
    expect(items).toContain("Black Ships weightlifting, 2 months");
    expect(after.sections.itinerary.map((day) => day.title)).toEqual(["My own day"]);
  });
});
