import { describe, expect, it } from "vitest";
import {
  buildPastDueMap,
  matchArCustomerToContact,
  normalizeCustomerName,
  type ArContact,
} from "./matchArCustomers";

const CONTACTS: ArContact[] = [
  { id: "bnb", name: "BnB Getaway", company: "BnB Getaway" },
  { id: "contigo", name: "Dagny Yznaga", company: "Contigo Accounting" },
  { id: "ari", name: "Rosa Lopez", company: "ARI Warehouse" },
  { id: "mike", name: "Mike Arnett", company: null },
];

describe("normalizeCustomerName", () => {
  it("drops legal suffixes and case", () => {
    expect(normalizeCustomerName("BnB Getaway LLC")).toBe("bnb getaway");
    expect(normalizeCustomerName("Lori Klein CPA")).toBe("lori klein");
  });
});

describe("matchArCustomerToContact", () => {
  it("matches exact and suffixed names", () => {
    expect(matchArCustomerToContact("BnB Getaway", CONTACTS)).toBe("bnb");
    expect(matchArCustomerToContact("BnB Getaway LLC", CONTACTS)).toBe("bnb");
    expect(matchArCustomerToContact("Contigo Accounting", CONTACTS)).toBe("contigo");
  });

  it("matches a sub-customer through its parent", () => {
    expect(
      matchArCustomerToContact(
        "ARI Warehouse Solutions:ARI Warehouse Solutions Cleanup",
        CONTACTS,
      ),
    ).toBe("ari");
  });

  it("refuses near misses", () => {
    expect(matchArCustomerToContact("Diana Arnett", CONTACTS)).toBeNull();
    expect(matchArCustomerToContact("Unknown Partner", CONTACTS)).toBeNull();
  });
});

describe("buildPastDueMap", () => {
  it("totals only open balances past their due date", () => {
    const result = buildPastDueMap(
      [
        { customerName: "BnB Getaway", dueDate: new Date("2026-07-01T00:00:00Z"), openBalance: 150 },
        { customerName: "Contigo Accounting", dueDate: new Date("2026-11-08T00:00:00Z"), openBalance: 300 },
        { customerName: "Contigo Accounting", dueDate: null, openBalance: 25 },
        { customerName: "Nobody", dueDate: new Date("2026-01-01T00:00:00Z"), openBalance: 10 },
      ],
      CONTACTS,
      "2026-11-05",
    );
    expect(result.get("bnb")).toEqual({
      pastDue: 150,
      oldestDue: "2026-07-01",
      aging: { days30: 0, days60: 0, days90: 0, over90: 150 },
    });
    expect(result.has("contigo")).toBe(false);
  });
});
