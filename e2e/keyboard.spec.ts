import { expect, test } from "@playwright/test";
import {
  contrastRatio,
  effectiveColors,
  gotoReady,
  menuOptions,
  serverIsUp,
  signInAsStaff,
} from "./support";

/**
 * Browser coverage for the keyboard-first layer.
 *
 * The unit suite proves the matching logic; only a real browser can prove the
 * parts that matter most in practice — that a chord actually reaches the page,
 * that we do not swallow keys meant for a text field, and that the new surfaces
 * are legible inside the app shell (where a known CSS override has previously
 * repainted controls to 1.09:1 contrast).
 */
test.describe("keyboard layer", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    expect(await serverIsUp(baseURL), "Start a dev server before running browser checks").toBe(true);
    await signInAsStaff(page);
  });

  test("Ctrl+K opens the Go menu and Escape closes it", async ({ page }) => {
    await gotoReady(page, "/offers");

    await page.keyboard.press("Control+k");
    const menu = page.getByRole("combobox", { name: /search commands/i });
    await expect(menu).toBeVisible({ timeout: 15_000 });
    await expect(menu).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
  });

  test("typing filters immediately, with no separate search step", async ({ page }) => {
    await gotoReady(page, "/offers");
    await page.keyboard.press("Control+k");

    // The omarchy-menu contract: the card opens and typing filters. There is no
    // "click the search box" step, so these keystrokes must land in the filter.
    await page.keyboard.type("agree");
    const options = menuOptions(page);
    await expect(options.first()).toBeVisible();
    await expect(options.first()).toContainText(/agreements/i);
  });

  test("Escape is two-stage: clear the filter, then close", async ({ page }) => {
    await gotoReady(page, "/offers");
    await page.keyboard.press("Control+k");
    const input = page.getByRole("combobox", { name: /search commands/i });
    await page.keyboard.type("agree");
    await expect(input).toHaveValue("agree");

    await page.keyboard.press("Escape");
    await expect(input).toHaveValue("");
    await expect(input).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(input).toBeHidden();
  });

  test("descends into a submenu and Backspace pops back out", async ({ page }) => {
    await gotoReady(page, "/offers");
    await page.keyboard.press("Control+k");

    const go = page.locator("#command-menu-row-go");
    await expect(go).toBeVisible();
    await go.click();

    // Inside "Go" the placeholder reflects the level we descended into.
    const input = page.getByRole("combobox", { name: /search go/i });
    await expect(input).toBeVisible();
    await expect(page.locator("#command-menu-row-nav\\.dashboard")).toBeVisible();

    // Backspace pops a level only because the filter is empty.
    await page.keyboard.press("Backspace");
    await expect(page.locator("#command-menu-row-go")).toBeVisible();
  });

  test("g o navigates to Offers", async ({ page }) => {
    await gotoReady(page, "/dashboard");
    await page.keyboard.press("g");
    // The armed prefix is shown, which is also the proof it was captured.
    await expect(page.locator(".ui-key-hint")).toBeVisible();
    await page.keyboard.press("o");
    await page.waitForURL(/\/offers/, { timeout: 20_000 });
  });

  test("? opens the help sheet and its rows are runnable", async ({ page }) => {
    await gotoReady(page, "/offers");
    await page.keyboard.press("?");

    const help = page.getByRole("heading", { name: /keyboard shortcuts/i });
    await expect(help).toBeVisible({ timeout: 15_000 });

    // Executable, not a dead cheat-sheet: the row is a real button.
    const row = page.getByRole("button", { name: /Dashboard/ }).first();
    await expect(row).toBeEnabled();
  });

  test("shortcuts do not fire while typing in a text field", async ({ page }) => {
    await gotoReady(page, "/contacts");
    const search = page.locator('input[name="q"]').first();
    await expect(search).toBeVisible({ timeout: 20_000 });
    await search.click();

    // "go" contains the g leader and the o open-row alias. Inside an input both
    // must be plain text, and the URL must not change.
    const before = page.url();
    await page.keyboard.type("going");
    await expect(search).toHaveValue("going");
    await expect(page.locator(".ui-key-hint")).toBeHidden();
    expect(page.url()).toBe(before);
  });

  test("Ctrl+K still opens the menu from inside a text field", async ({ page }) => {
    await gotoReady(page, "/contacts");
    const search = page.locator('input[name="q"]').first();
    await search.click();
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("combobox", { name: /search commands/i })).toBeVisible();
  });

  test("j and k move a visible row cursor on the offers list", async ({ page }) => {
    await gotoReady(page, "/offers");
    const rows = page.locator("[data-keyboard-row]");
    const count = await rows.count();
    test.skip(count < 2, "needs at least two offers to move a cursor");

    await page.keyboard.press("j");
    await expect(rows.nth(0)).toHaveAttribute("data-keyboard-active", "true");
    await expect(rows.nth(0)).toBeFocused();

    await page.keyboard.press("j");
    await expect(rows.nth(1)).toHaveAttribute("data-keyboard-active", "true");

    await page.keyboard.press("k");
    await expect(rows.nth(0)).toHaveAttribute("data-keyboard-active", "true");
  });

  test("the list uses a roving tabindex rather than one stop per row", async ({ page }) => {
    await gotoReady(page, "/offers");
    const rows = page.locator("[data-keyboard-row]");
    const count = await rows.count();
    test.skip(count < 2, "needs at least two offers");

    await page.keyboard.press("j");
    const tabIndexes = await rows.evaluateAll((els) =>
      els.map((el) => (el as HTMLElement).tabIndex),
    );
    // Exactly one tab stop, so Tab steps past the whole list in one press.
    expect(tabIndexes.filter((value) => value === 0)).toHaveLength(1);
  });

  test("Enter opens the focused offer row", async ({ page }) => {
    await gotoReady(page, "/offers");
    const rows = page.locator("[data-keyboard-row]");
    test.skip((await rows.count()) < 1, "needs at least one offer");

    await page.keyboard.press("j");
    await page.keyboard.press("Enter");
    await page.waitForURL((url) => !url.pathname.match(/^\/offers\/?$/), { timeout: 20_000 });
  });

  test("the skip link is the first tab stop and reaches main content", async ({ page }) => {
    await gotoReady(page, "/offers");
    await page.keyboard.press("Tab");

    const skip = page.getByRole("link", { name: /skip to content/i });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main-content$/);
    // Focusable by script, which is what lets the jump land for screen readers.
    await expect(page.locator("#main-content")).toHaveAttribute("tabindex", "-1");
  });

  test("the new surfaces are legible inside the app shell", async ({ page }) => {
    // Guards the class of bug that made bg-brandnavy buttons render at 1.09:1
    // inside .app-shell-root. These surfaces are built from theme tokens, so
    // this should hold in both themes.
    await gotoReady(page, "/offers");
    await page.keyboard.press("Control+k");

    const row = menuOptions(page).first();
    await expect(row).toBeVisible();
    const { color, background } = await effectiveColors(row);
    expect(contrastRatio(color, background)).toBeGreaterThan(4.5);
  });

  test("the builder stepper marks the current step and jumps by digit", async ({ page }) => {
    await gotoReady(page, "/offers/contact");

    const stepper = page.getByRole("navigation", { name: /offer builder steps/i });
    await expect(stepper).toBeVisible({ timeout: 20_000 });
    await expect(stepper.locator('[aria-current="step"]')).toContainText(/contact/i);

    await page.keyboard.press("3");
    await page.waitForURL(/\/offers\/complexity/, { timeout: 20_000 });
    await expect(stepper.locator('[aria-current="step"]')).toContainText(/complexity/i);
  });

  test("[ and ] step through the builder", async ({ page }) => {
    await gotoReady(page, "/offers/scale");
    await expect(page.getByRole("navigation", { name: /offer builder steps/i })).toBeVisible({
      timeout: 20_000,
    });

    await page.keyboard.press("]");
    await page.waitForURL(/\/offers\/complexity/, { timeout: 20_000 });

    await page.keyboard.press("[");
    await page.waitForURL(/\/offers\/scale/, { timeout: 20_000 });
  });

  test("builder digits are inert outside the builder", async ({ page }) => {
    await gotoReady(page, "/offers");
    const before = page.url();
    await page.keyboard.press("3");
    await page.waitForTimeout(500);
    expect(page.url()).toBe(before);
  });

  test("no console errors while driving the keyboard layer", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    await gotoReady(page, "/offers");
    await page.keyboard.press("Control+k");
    await page.keyboard.type("dash");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await page.keyboard.press("?");
    await page.keyboard.press("Escape");
    await page.keyboard.press("j");
    await page.keyboard.press("k");
    await page.waitForTimeout(500);

    expect(errors).toEqual([]);
  });
});
