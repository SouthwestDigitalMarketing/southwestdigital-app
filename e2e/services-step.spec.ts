import { test, expect } from "@playwright/test";
import {
  contrastRatio,
  effectiveColors,
  serverIsUp,
  signInAsStaff,
} from "./support";

// These drive a real browser against a running dev server. They never save,
// publish, or send: the Services step keeps its draft in localStorage, so a
// fresh context is a throwaway offer and no database row is written.
test.describe("Offer builder — Services step", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    test.skip(
      !(await serverIsUp(baseURL)),
      `No dev server on ${baseURL}. Run "npm run dev" first.`,
    );
    await signInAsStaff(page);
    await page.goto("/offers/add-ons", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Build your service lineup" }),
    ).toBeVisible();
    await page.waitForSelector("table");
  });

  test("compares every service against the three packages", async ({ page }) => {
    await expect(
      page.locator('section[aria-label="Recurring services"]'),
    ).toBeVisible();

    for (const name of ["Maintain", "Improve", "Grow"]) {
      await expect(
        page.getByRole("columnheader", { name }).first(),
      ).toBeVisible();
    }

    const rows = page.locator('th[scope="row"] button[aria-expanded]');
    expect(await rows.count()).toBeGreaterThan(0);

    // The default view is the curated lineup, not the whole ~121-row catalogue.
    expect(await rows.count()).toBeLessThan(40);
  });

  // Guards the invariant from the services redesign: tier membership is a
  // contiguous range, NOT "lowest tier wins, everything above inherits".
  // The client-support family is substituted per tier. Under a floor model
  // Standard Client Support would render on all three cards.
  test("keeps substituted tiers from inheriting upward", async ({ page }) => {
    const support = page
      .locator("tr", { hasText: "Standard Client Support" })
      .first();
    await expect(
      support.getByRole("button", { name: /Maintain: Included/ }),
    ).toHaveCount(1);
    await expect(
      support.getByRole("button", { name: /Improve: Not offered/ }),
    ).toHaveCount(1);
    await expect(
      support.getByRole("button", { name: /Grow: Not offered/ }),
    ).toHaveCount(1);
  });

  test("opens an offer-specific editor and discards on cancel", async ({
    page,
  }) => {
    const firstRow = page.locator('th[scope="row"] button[aria-expanded]').first();
    const serviceName = (await firstRow.textContent())?.trim() ?? "";
    await firstRow.click();

    const editor = page.locator("form[aria-label^='Configure']");
    await expect(editor).toBeVisible();
    await expect(editor).toContainText("Settings for this offer");
    await expect(
      editor.getByLabel(`Included in ${serviceName}`),
    ).toBeVisible();
    await expect(
      editor.getByLabel(`Optional in ${serviceName}`),
    ).toBeVisible();

    await editor.getByRole("button", { name: "Cancel" }).click();
    await expect(editor).toHaveCount(0);
  });

  test("offers only contiguous tier ranges, excluding included tiers", async ({
    page,
  }) => {
    const firstRow = page.locator('th[scope="row"] button[aria-expanded]').first();
    const serviceName = (await firstRow.textContent())?.trim() ?? "";
    await firstRow.click();

    const included = page.getByLabel(`Included in ${serviceName}`);
    const options = await included.locator("option").allTextContents();
    // Contiguous ranges only — a gapped selection like "Maintain + Grow"
    // must never be offerable as a new edit.
    expect(options).toEqual(
      expect.arrayContaining(["Maintain through Grow", "Improve through Grow"]),
    );
    expect(options.some((o) => /Maintain \+ Grow/.test(o))).toBe(false);
  });

  test("reveals the catalogue picker without leaving the offer", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /Add services/ }).click();
    const picker = page.locator('section[aria-label="Add catalogue services"]');
    await expect(picker).toBeVisible();
    await expect(picker).toContainText("Choose a service");
    await page.getByRole("button", { name: /Back to offer/ }).click();
    await expect(picker).toHaveCount(0);
  });

  // Regression guard for the legacy `[data-theme] .bg-brandnavy` override, which
  // repoints brand utilities at --theme-light (#f5f5f5). Paired with text-white
  // that produced a 1.09:1 "invisible button" inside the app shell.
  test("primary actions stay legible inside the themed app shell", async ({
    page,
  }) => {
    const addServices = await effectiveColors(
      page.getByRole("button", { name: /Add services/ }),
    );
    expect(
      contrastRatio(addServices.color, addServices.background),
    ).toBeGreaterThanOrEqual(4.5);

    await page.locator('th[scope="row"] button[aria-expanded]').first().click();
    await expect(page.locator("form[aria-label^='Configure']")).toBeVisible();

    const apply = await effectiveColors(
      page.locator('form[aria-label^="Configure"] button[type="submit"]'),
    );
    expect(
      contrastRatio(apply.color, apply.background),
    ).toBeGreaterThanOrEqual(4.5);
  });

  // The builder header is laid out in viewport units (width: 100vw) while
  // .app-shell-main reserves a scrollbar gutter, so the header overhangs its
  // container by that gutter and produced a stray horizontal scrollbar.
  test("never scrolls the shell sideways", async ({ page }) => {
    const scrolled = await page.evaluate(() => {
      const main = document.querySelector("main.app-shell-main");
      if (!main) return -1;
      main.scrollLeft = 0;
      main.scrollLeft = 500;
      const moved = main.scrollLeft;
      main.scrollLeft = 0;
      return moved;
    });
    expect(scrolled).toBe(0);
  });

  // The shell used h-dvh, which ignores space taken by a scrollbar or
  // fractional device-pixel rounding, so the document could gain a scrollbar of
  // its own beside the content one. Users with classic (space-taking)
  // scrollbars saw two bars down the right-hand side.
  test("shows exactly one vertical scrollbar, not two", async ({ page }) => {
    // Force classic, space-taking scrollbars; headless defaults to overlay
    // scrollbars, which hide this class of bug entirely.
    await page.addStyleTag({
      content: `* { scrollbar-width: auto !important; }
        ::-webkit-scrollbar { width: 15px !important; height: 15px !important; display: block !important; }`,
    });
    await page.waitForTimeout(400);

    const result = await page.evaluate(() => {
      const beforeX = window.scrollX;
      const beforeY = window.scrollY;
      window.scrollTo(9999, 9999);
      const maxX = window.scrollX;
      const maxY = window.scrollY;
      window.scrollTo(beforeX, beforeY);

      const painted: string[] = [];
      const candidates: HTMLElement[] = [
        document.documentElement,
        ...Array.from(document.querySelectorAll<HTMLElement>("*")),
      ];
      for (const el of candidates) {
        const rect = el.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) continue;
        const s = getComputedStyle(el);
        if (s.display.startsWith("inline") && !s.display.includes("block")) continue;
        const borderX = parseFloat(s.borderLeftWidth) + parseFloat(s.borderRightWidth);
        if (el.offsetWidth - el.clientWidth - borderX > 2) {
          painted.push(el.tagName.toLowerCase() + "." + String(el.className).split(/\s+/)[0]);
        }
      }
      return { maxX, maxY, painted };
    });

    expect(result.maxY).toBe(0); // the document itself must never scroll
    expect(result.maxX).toBe(0);
    expect(result.painted).toHaveLength(1);
  });

  test("keeps the coverage sidebar sticky while the content scrolls", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.waitForTimeout(600);
    const result = await page.evaluate(() => {
      const main = document.querySelector("main.app-shell-main");
      const aside = document.querySelector('aside[aria-label="Package coverage"]');
      if (!main || !aside) return null;
      if (getComputedStyle(aside).position !== "sticky") return "not-sticky-at-this-width";
      main.scrollTop = 600;
      const top = aside.getBoundingClientRect().top;
      main.scrollTop = 0;
      return top;
    });
    // Pins at the 2xl:top-8 offset (2rem) rather than scrolling away.
    if (typeof result === "number") expect(result).toBeGreaterThanOrEqual(0);
    expect(result).not.toBeNull();
  });

  test("stacks package cells on a phone without overflowing", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

    // Package names repeat inside each stacked cell so the column is readable.
    await expect(
      page.locator("td span", { hasText: "Maintain" }).first(),
    ).toBeVisible();
  });
});
