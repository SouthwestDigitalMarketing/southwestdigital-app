import { test, expect } from "@playwright/test";
import { gotoReady, serverIsUp, signInAsStaff } from "./support";

test.describe("keyboard overlays", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    expect(await serverIsUp(baseURL), "Start a dev server before running browser checks").toBe(true);
    await signInAsStaff(page);
  });

  test("contacts assignment picker: keyboard open + Escape closes + focus returns", async ({ page }) => {
    await gotoReady(page, "/contacts");
    await page.locator('a[href^="/contacts/"]').first().click();
    await page.waitForURL(/\/contacts\/[^/]+$/, { waitUntil: "domcontentloaded" });
    const trigger = page.locator('button[popovertarget^="assignment-picker-"]').first();
    await expect(trigger).toBeVisible({ timeout: 20000 });
    await trigger.focus();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await page.keyboard.press("Enter");
    const panelId = await trigger.getAttribute("popovertarget");
    const panel = page.locator(`#${panelId}`);
    await expect(panel).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(trigger).toHaveAttribute("aria-haspopup", "true");
    // Tab lands inside the panel (top layer is next in sequential order).
    await page.keyboard.press("Tab");
    expect(await panel.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(await trigger.evaluate((el) => el === document.activeElement)).toBe(true);
  });

  test("options templates dropdown: Escape closes, focus returns", async ({ page }) => {
    await page.goto("/offers/add-ons", { waitUntil: "domcontentloaded" });
    const disclosure = page.getByText("Templates and catalogue tools");
    await expect(disclosure).toBeVisible({ timeout: 30000 });
    await disclosure.click();
    const trigger = page.locator('button[popovertarget^="options-templates-"]').first();
    await expect(trigger).toBeVisible({ timeout: 30000 });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const panelId = await trigger.getAttribute("popovertarget");
    const panel = page.locator(`#${panelId}`);
    await expect(panel).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(await trigger.evaluate((el) => el === document.activeElement)).toBe(true);
  });

  test("fullscreen proposal preview is a modal dialog that Escape closes", async ({ page }) => {
    await page.goto("/offers/intro?preview=fullscreen", { waitUntil: "domcontentloaded" });
    const dialog = page.locator('dialog[open][aria-label="Full-screen proposal preview"]');
    await expect(dialog).toBeVisible({ timeout: 30000 });
    // Focus is inside the dialog and the builder behind it is inert.
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    const exit = page.getByRole("button", { name: "Exit full-screen proposal preview" });
    await expect(exit).toBeVisible();
    expect(
      await page.evaluate(() => {
        const outside = document.querySelector("main section input, main section select");
        if (!(outside instanceof HTMLElement)) return "none";
        outside.focus();
        return document.activeElement === outside ? "focused" : "blocked";
      }),
    ).not.toBe("focused");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/offers\/intro(?!.*preview=fullscreen)/);
  });

  test("settings logo dropzones are keyboard operable", async ({ page }) => {
    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    const zones = page.locator('button[aria-label$="backgrounds"]');
    await expect(zones.first()).toBeVisible({ timeout: 30000 });
    expect(await zones.count()).toBe(4);
    await zones.first().focus();
    const chooser = page.waitForEvent("filechooser");
    await page.keyboard.press("Enter");
    expect(await chooser).toBeTruthy();
    // Focus ring only paints for keyboard focus.
    const outline = await zones.first().evaluate((el) => getComputedStyle(el).outlineWidth);
    expect(outline).not.toBe("0px");
  });
});

test.describe("mouse paths still work", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    expect(await serverIsUp(baseURL), "Start a dev server before running browser checks").toBe(true);
    await signInAsStaff(page);
  });

  test("native fullscreen preview opens from the header and exits by click", async ({ page }) => {
    await page.goto("/offers/intro", { waitUntil: "domcontentloaded" });
    const open = page.getByRole("button", { name: "Preview fullscreen in this tab" });
    await expect(open).toBeVisible({ timeout: 30000 });
    await open.click();
    const dialog = page.locator('dialog[open][aria-label="Full-screen proposal preview"]');
    await expect(dialog).toBeVisible({ timeout: 30000 });
    expect(await page.evaluate(() => document.fullscreenElement === document.documentElement)).toBe(true);
    // Pencil control still toggles the contextual edit affordances.
    const pencil = page.getByRole("button", { name: "Show proposal edit controls" });
    await pencil.click();
    await expect(page.getByRole("button", { name: "Hide proposal edit controls" })).toBeVisible();
    await page.getByRole("button", { name: "Exit full-screen proposal preview" }).click();
    await expect(dialog).toHaveCount(0);
    expect(await page.evaluate(() => document.fullscreenElement === null)).toBe(true);
    await expect(page).toHaveURL(/\/offers\/intro(?!.*preview=fullscreen)/);
  });

  test("assignment picker opens by mouse, positions on screen, and light-dismisses", async ({ page }) => {
    await gotoReady(page, "/contacts");
    await page.locator('a[href^="/contacts/"]').first().click();
    await page.waitForURL(/\/contacts\/[^/]+$/, { waitUntil: "domcontentloaded" });
    const trigger = page.locator('button[popovertarget^="assignment-picker-"]').first();
    await trigger.click();
    const panelId = await trigger.getAttribute("popovertarget");
    const panel = page.locator(`#${panelId}`);
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(100);
    await page.mouse.click(5, 5);
    await expect(panel).toBeHidden();
  });

  test("options dropdown loads a template on click", async ({ page }) => {
    await page.goto("/offers/add-ons", { waitUntil: "domcontentloaded" });
    const disclosure = page.getByText("Templates and catalogue tools");
    await expect(disclosure).toBeVisible({ timeout: 30000 });
    await disclosure.click();
    const trigger = page.locator('button[popovertarget^="options-templates-"]').first();
    await trigger.click();
    const panelId = await trigger.getAttribute("popovertarget");
    const panel = page.locator(`#${panelId}`);
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    const triggerBox = await trigger.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(triggerBox!.width - 1);
    expect(Math.abs(box!.y - (triggerBox!.y + triggerBox!.height + 4))).toBeLessThan(2);
    const item = panel.locator("button").first();
    if (await item.count()) {
      await item.click();
      await expect(panel).toBeHidden();
    }
  });
});
