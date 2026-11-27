import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AccountEntry, BandOverride } from "@/lib/quotes/accountInventory";
import AccountInventoryEditor, {
  AccountInventoryOverrideForm,
  initialOverrideDraft,
  overrideDraftKey,
} from "./AccountInventoryEditor";

const bigInventory: AccountEntry[] = [
  { id: "checking", kind: "checking", label: "Chase", monthlyTransactions: 1100, status: "open", basis: "measured" },
];

function editorHtml(accounts: AccountEntry[], bandOverride: BandOverride | null) {
  return renderToStaticMarkup(createElement(AccountInventoryEditor, {
    accounts, bandOverride, onAccountsChange: () => {}, onOverrideChange: () => {},
  }));
}

describe("override draft initialization", () => {
  it("starts blank without a saved override", () => {
    expect(initialOverrideDraft(null)).toEqual({ band: "100-499", reason: "" });
  });

  it("starts from the saved override and reason when one is loaded", () => {
    const saved = { band: "unknown", reason: "Client confirmed" } as const;
    expect(initialOverrideDraft(saved)).toEqual({ band: "unknown", reason: "Client confirmed" });
  });

  it("keys the form by the loaded override so a new load replaces a stale draft", () => {
    expect(overrideDraftKey(null)).toBe("none");
    const first = { band: "unknown", reason: "First" } as BandOverride;
    const second = { band: "0-99", reason: "Rechecked" } as BandOverride;
    expect(overrideDraftKey(first)).not.toBe(overrideDraftKey(second));
    expect(overrideDraftKey(first)).toBe(overrideDraftKey({ ...first }));
  });

  it("mounts the form with the loaded draft, and a newly loaded override mounts fresh", () => {
    const loaded = initialOverrideDraft({ band: "unknown", reason: "Client confirmed" });
    const first = renderToStaticMarkup(createElement(AccountInventoryOverrideForm, {
      initial: loaded, onApply: () => {}, onCancel: () => {},
    }));
    expect(first).toContain('value="unknown" selected');
    expect(first).toContain('value="Client confirmed"');
    expect(first).toContain("Cancel");

    // A key change remounts the form, so the newly loaded override wins.
    const reloaded = initialOverrideDraft({ band: "0-99", reason: "Rechecked" });
    const second = renderToStaticMarkup(createElement(AccountInventoryOverrideForm, {
      initial: reloaded, onApply: () => {}, onCancel: () => {},
    }));
    expect(second).toContain('value="0-99" selected');
    expect(second).toContain('value="Rechecked"');
    // Cancel is a plain button: it only closes the editor, never applies.
    expect(second).toContain('type="button"');
  });
});

describe("overridden band display", () => {
  it("shows both the override and the derived band", () => {
    expect(editorHtml(bigInventory, { band: "unknown", reason: "Client confirmed" }))
      .toContain("Band: unknown (manual override; accounts say 1000+)");
  });

  it("keeps the plain derived label without an override", () => {
    expect(editorHtml(bigInventory, null)).toContain("Band: 1000+ (from accounts)");
  });
});
