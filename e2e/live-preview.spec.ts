import { test, expect, type Page } from "@playwright/test";
import { serverIsUp, signInAsStaff } from "./support";

// Drives the real two-tab flow: the builder in one tab, the live preview in
// another, both in one browser context so they share localStorage and the
// BroadcastChannel. Nothing here saves or publishes — the builder keeps its
// draft in localStorage, so a fresh context is a throwaway offer.
const PREVIEW_BUTTON = "Open live preview in a new tab";

async function openCompanyEditor(page: Page) {
  await page.getByRole("button", { name: "Edit" }).first().click();
  const editor = page.getByRole("dialog");
  await expect(editor.getByRole("heading", { name: "Edit Company / Book Set" })).toBeVisible();
  return editor;
}

test.describe("Offer builder — live preview tab", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    expect(await serverIsUp(baseURL), `Start a dev server on ${baseURL} before browser QA`).toBe(true);
    await signInAsStaff(page);
    await page.goto("/offers/contact", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Company / Book Set" })).toBeVisible();
  });

  test("mirrors builder edits into the preview tab without a reload", async ({ page, context }) => {
    const [preview] = await Promise.all([
      context.waitForEvent("page"),
      page.getByRole("button", { name: PREVIEW_BUTTON }).click(),
    ]);
    await preview.waitForLoadState("domcontentloaded");
    expect(new URL(preview.url()).pathname).toBe("/offer-preview");

    // Wait for the mirror to finish its own first read before editing, so the
    // assertion below can only pass via the live subscription.
    await expect(preview.locator("body")).not.toContainText("Loading proposal…");

    const companyName = `Live Preview QA ${Date.now()}`;
    const editor = await openCompanyEditor(page);
    await editor.getByLabel("Business name").fill(companyName);

    // No reload, no navigation on the preview tab — this must arrive over the
    // BroadcastChannel subscription alone.
    await expect(preview.getByText(companyName).first()).toBeVisible({ timeout: 15_000 });
  });

  test("keeps following a second edit", async ({ page, context }) => {
    const [preview] = await Promise.all([
      context.waitForEvent("page"),
      page.getByRole("button", { name: PREVIEW_BUTTON }).click(),
    ]);
    await preview.waitForLoadState("domcontentloaded");

    const editor = await openCompanyEditor(page);
    const first = `First QA ${Date.now()}`;
    await editor.getByLabel("Business name").fill(first);
    await expect(preview.getByText(first).first()).toBeVisible({ timeout: 15_000 });

    const second = `Second QA ${Date.now()}`;
    await editor.getByLabel("Business name").fill(second);
    await expect(preview.getByText(second).first()).toBeVisible({ timeout: 15_000 });
    await expect(preview.getByText(first)).toHaveCount(0);
  });

  test("never writes builder state back from the preview tab", async ({ page, context }) => {
    const companyName = `Read Only QA ${Date.now()}`;
    const editor = await openCompanyEditor(page);
    await editor.getByLabel("Business name").fill(companyName);
    await page.getByRole("button", { name: "Save changes" }).click();

    const storedBefore = await page.evaluate(() =>
      JSON.stringify(
        Object.fromEntries(
          Object.keys(window.localStorage)
            .filter((key) => key.startsWith("proposal-app-demo-"))
            .map((key) => [key, window.localStorage.getItem(key)]),
        ),
      ),
    );

    const [preview] = await Promise.all([
      context.waitForEvent("page"),
      page.getByRole("button", { name: PREVIEW_BUTTON }).click(),
    ]);
    await preview.waitForLoadState("domcontentloaded");
    await expect(preview.getByText(companyName).first()).toBeVisible({ timeout: 15_000 });
    // Give the mirror ample time to (incorrectly) persist anything.
    await preview.waitForTimeout(1500);

    const storedAfter = await page.evaluate(() =>
      JSON.stringify(
        Object.fromEntries(
          Object.keys(window.localStorage)
            .filter((key) => key.startsWith("proposal-app-demo-"))
            .map((key) => [key, window.localStorage.getItem(key)]),
        ),
      ),
    );

    expect(storedAfter).toBe(storedBefore);
  });

  // End-to-end smoke test that the preview tracks character-by-character input.
  //
  // It does NOT isolate the debounce ceiling: verified by mutation, this test
  // still passes with the ceiling disabled, because a dev-mode React render per
  // keystroke already stretches the gaps past the debounce interval. The ceiling
  // itself is proven deterministically in proposalSyncSchedule.test.ts.
  test("keeps updating while the user is still typing", async ({ page, context }) => {
    const [preview] = await Promise.all([
      context.waitForEvent("page"),
      page.getByRole("button", { name: PREVIEW_BUTTON }).click(),
    ]);
    await preview.waitForLoadState("domcontentloaded");

    const editor = await openCompanyEditor(page);
    const field = editor.getByLabel("Business name");
    await field.fill("");

    // 25 characters at 60ms/key = ~1.5s of continuous typing, every gap well
    // under the 150ms debounce interval.
    const marker = "Zyx";
    const typing = field.pressSequentially(`${marker} Continuous Typing Co`, { delay: 60 });

    // Must appear BEFORE typing finishes.
    await expect(preview.getByText(new RegExp(marker)).first()).toBeVisible({ timeout: 3_000 });

    await typing;
    await expect(preview.getByText(/Zyx Continuous Typing Co/).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("reuses one preview tab across repeat clicks", async ({ page, context }) => {
    const [preview] = await Promise.all([
      context.waitForEvent("page"),
      page.getByRole("button", { name: PREVIEW_BUTTON }).click(),
    ]);
    await preview.waitForLoadState("domcontentloaded");
    const pagesAfterFirst = context.pages().length;

    await page.getByRole("button", { name: PREVIEW_BUTTON }).click();
    await page.waitForTimeout(1000);

    expect(context.pages().length).toBe(pagesAfterFirst);
  });
});
