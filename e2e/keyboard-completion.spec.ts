import { expect, test } from "@playwright/test";
import { gotoReady, serverIsUp, signInAsStaff } from "./support";

test.beforeEach(async ({ page, baseURL }) => {
  expect(await serverIsUp(baseURL), "Start a dev server before running browser checks").toBe(true);
  await signInAsStaff(page);
});

test("page search selects existing text and ordinary typing stays local", async ({ page }) => {
  for (const path of ["/contacts", "/clients"]) {
    await gotoReady(page, path);
    const input = page.locator('input[name="q"]');
    await page.keyboard.press("/");
    await expect(input).toBeFocused();
    await input.fill("example");
    await input.blur();
    await page.keyboard.press("/");
    expect(await input.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd])).toEqual([0, 7]);
    await page.keyboard.type("going");
    await expect(input).toHaveValue("going");
  }
});

test("builder digit and menu navigation preserve the current query", async ({ page }) => {
  await gotoReady(page, "/offers/contact?keyboardProbe=preserved");
  await page.waitForSelector('html[data-keyboard-scopes~="builder"]');
  await page.keyboard.press("3");
  await expect(page).toHaveURL(/\/offers\/complexity\?keyboardProbe=preserved$/);
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: "Search commands" }).fill("Style");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/offers\/intro\?keyboardProbe=preserved$/);
});

test("modal and popover controls cannot dispatch background list or navigation keys", async ({ page }) => {
  await gotoReady(page, "/contacts");
  await page.locator('a[href^="/contacts/"]').first().click();
  await page.waitForURL(/\/contacts\/[^/]+$/, { waitUntil: "domcontentloaded" });
  const before = page.url();
  const trigger = page.locator('button[popovertarget^="assignment-picker-"]').first();
  await trigger.click();
  const panel = page.locator('[popover]:popover-open');
  const checkbox = panel.locator('input[type="checkbox"]').first();
  await expect(checkbox).toBeVisible();
  await checkbox.focus();
  await page.keyboard.press("j");
  await expect(checkbox).toBeFocused();
  await page.keyboard.press("g");
  await page.keyboard.press("o");
  expect(page.url()).toBe(before);
  await page.keyboard.press("Escape");
  await gotoReady(page, "/offers/intro?preview=fullscreen");
  const dialog = page.getByRole("dialog", { name: "Full-screen proposal preview" });
  await expect(dialog).toBeVisible();
  const exit = page.getByRole("button", { name: "Exit full-screen proposal preview" });
  await exit.focus();
  await page.keyboard.press("3");
  await page.keyboard.press("g");
  await page.keyboard.press("o");
  await expect(exit).toBeFocused();
  await expect(page).toHaveURL(/preview=fullscreen/);
});

test("row-local open respects the single-key opt-out and the g o sequence", async ({ page }) => {
  await gotoReady(page, "/contacts");
  const row = page.locator('[data-keyboard-row]').first();
  await expect(row).toBeVisible();
  await row.focus();
  await page.keyboard.press("g");
  await page.keyboard.press("o");
  await expect(page).toHaveURL(/\/offers$/);
  await page.keyboard.press("?");
  await page.getByLabel("Turn off single-key shortcuts").check();
  await page.keyboard.press("Escape");
  const offer = page.locator('[data-keyboard-row]').first();
  await offer.focus();
  await page.keyboard.press("o");
  await expect(page).toHaveURL(/\/offers$/);
  await page.keyboard.press("Enter");
  await expect(page).not.toHaveURL(/\/offers$/);
});

test("arrows belong to the focused row and leave native widgets untouched", async ({ page }) => {
  await gotoReady(page, "/offers");
  const rows = page.locator('[data-keyboard-row]');
  await rows.first().focus();
  await page.keyboard.press("ArrowDown");
  await expect(rows.nth(1)).toBeFocused();
  // An actual range input exercises the browser's default arrow behavior.
  await page.evaluate(() => {
    const range = document.createElement("input");
    range.type = "range";
    range.id = "native-range-probe";
    range.value = "50";
    document.querySelector("main")!.prepend(range);
    range.focus();
  });
  await page.keyboard.press("ArrowUp");
  await expect(page.locator("#native-range-probe")).toHaveValue("51");
  await expect(page.locator("#native-range-probe")).toBeFocused();
});

test("sidebar resizing works by keyboard and stays within its scroll container", async ({ page }) => {
  await gotoReady(page, "/offers");
  const handle = page.getByRole("separator", { name: "Resize sidebar" }).filter({ visible: true });
  await handle.focus();
  await page.keyboard.press("Home");
  await expect(handle).toHaveAttribute("aria-valuenow", "64");
  await page.keyboard.press("ArrowRight");
  await expect(handle).toHaveAttribute("aria-valuenow", "112");
  await page.keyboard.press("End");
  await expect(handle).toHaveAttribute("aria-valuenow", "320");
  await page.keyboard.press("ArrowLeft");
  await expect(handle).toHaveAttribute("aria-valuenow", "304");
  expect(await handle.evaluate((el) => el.parentElement!.scrollWidth - el.parentElement!.clientWidth)).toBe(0);
  const box = await handle.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + 100);
  await page.mouse.down();
  await page.mouse.move(250, box!.y + 100);
  await page.mouse.up();
  await expect(handle).toHaveAttribute("aria-valuenow", "250");
});

test("service cursor survives sorting, opens an editor, and does not navigate while editing", async ({ page }) => {
  await gotoReady(page, "/services");
  const rows = page.locator('[data-keyboard-row]');
  await rows.first().focus();
  const id = await rows.first().getAttribute("data-keyboard-row");
  await page.getByRole("button", { name: /Service Title/ }).click();
  const same = page.locator(`[data-keyboard-row="${id}"]`);
  await expect(same).toHaveAttribute("data-keyboard-active", "true");
  await same.focus();
  await page.keyboard.press("Enter");
  const name = page.locator('input[name="name"]');
  await expect(name).toBeFocused();
  await page.keyboard.press("j");
  await expect(name).toBeFocused();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(same).toBeFocused();
});

for (const path of ["/agreements", "/tags", "/discounts", "/media", "/pipeline"]) {
  test(`${path} has a reachable row cursor`, async ({ page }) => {
    await gotoReady(page, path);
    const rows = page.locator('[data-keyboard-row]');
    test.skip(await rows.count() === 0, `No records on ${path}`);
    await page.keyboard.press("j");
    await expect(rows.first()).toBeFocused();
    await expect(rows.first()).toHaveAttribute("tabindex", "0");
    if (path === "/agreements") {
      const checkbox = rows.first().locator('input[type="checkbox"]');
      const before = await checkbox.isChecked();
      await checkbox.focus();
      await page.keyboard.press("Space");
      await expect(checkbox).toBeChecked({ checked: !before });
      await page.keyboard.press("Space");
      await expect(checkbox).toBeChecked({ checked: before });
    } else if (["/tags", "/discounts", "/media"].includes(path)) {
      await page.keyboard.press("Enter");
      const name = page.locator(path === "/tags" ? 'tbody input[name="label"]' : 'input[name="name"]').first();
      await expect(name).toBeFocused();
      await page.getByRole("button", { name: "Cancel", exact: true }).first().click();
      await expect(rows.first()).toBeFocused();
    } else {
      // Choose a populated pipeline so the details/stage controls are exercised.
      const populatedIndex = await rows.evaluateAll((elements) => elements.findIndex((row) =>
        Number(row.querySelectorAll("td")[3]?.textContent?.trim()) > 0));
      test.skip(populatedIndex < 0, "No populated pipeline to exercise card details");
      await rows.nth(populatedIndex).focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/pipeline\/[^/]+$/);
      const cards = page.locator('[data-keyboard-row]');
      await expect(cards.first()).toBeVisible();
      await cards.first().focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText("Move to stage", { exact: true })).toBeVisible();
      const stageButton = dialog.locator('.pt-4 button:enabled').first();
      await expect(stageButton).toBeVisible();
      await stageButton.focus();
      await expect(stageButton).toBeFocused();
      // Do not move a real lead for browser QA.
      await page.keyboard.press("Escape");
      await expect(cards.first()).toBeFocused();
    }
  });
}

test("unhandled search and expired leader leave no dead command hint", async ({ page }) => {
  await gotoReady(page, "/dashboard");
  const prevented = await page.evaluate(() => {
    const event = new KeyboardEvent("keydown", { key: "/", bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(prevented).toBe(false);
  await page.keyboard.press("g");
  await expect(page.locator(".ui-key-hint")).toBeVisible();
  await expect(page.locator(".ui-key-hint")).toBeHidden({ timeout: 3000 });
});


test("menu composition, reserved chords, and text caret keys remain native", async ({ page }) => {
  await gotoReady(page, "/offers");
  await page.keyboard.press("Control+k");
  const input = page.getByRole("combobox", { name: "Search commands" });
  await input.fill("Offers");
  await page.keyboard.press("Home");
  expect(await input.evaluate((el: HTMLInputElement) => el.selectionStart)).toBe(0);
  await page.keyboard.press("End");
  expect(await input.evaluate((el: HTMLInputElement) => el.selectionStart)).toBe(6);
  expect(await input.evaluate((el) => {
    const event = new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true, cancelable: true });
    el.dispatchEvent(event);
    return event.defaultPrevented;
  })).toBe(false);
  expect(await input.evaluate((el) => {
    const event = new KeyboardEvent("keydown", { key: "K", ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true });
    el.dispatchEvent(event);
    return event.defaultPrevented;
  })).toBe(false);
  await expect(input).toBeVisible();
});

test("opening a published offer by keyboard uses staff preview", async ({ page }) => {
  await gotoReady(page, "/offers");
  const row = page.locator('[data-keyboard-row]').filter({ has: page.locator('a[href^="/proposal/"]') }).first();
  test.skip(await row.count() === 0, "No published offer to preview");
  const href = await row.locator('a[href^="/proposal/"]').first().getAttribute("href");
  expect(href).toContain("staffPreview=1");
  const expected = new URL(href!, page.url()).href;
  await row.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(expected);
});
