import { describe, expect, it } from "vitest";
import { isFlatDesktopMigrationOption } from "./desktopMigration";

const flat = (name: string) => ({ name, required: true, billingCadence: "one-time" });

describe("flat Desktop migration option name match", () => {
  it.each([
    "QuickBooks Desktop to Online Migration",
    "Desktop to Online Migration",
    "Desktop → Online migration",
    "Desktop -> Online Migration",
    "Desktop-Online Migration",
    "  quickbooks  desktop to quickbooks online migration ",
  ])("matches %s", (name) => {
    expect(isFlatDesktopMigrationOption(flat(name))).toBe(true);
  });
  it.each([
    "Desktop training for Online Migration course",
    "QuickBooks Desktop to Online Migration support add-on",
    "Online migration",
  ])("does not match %s", (name) => {
    expect(isFlatDesktopMigrationOption(flat(name))).toBe(false);
  });
});
