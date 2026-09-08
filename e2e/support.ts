import type { Cookie, Locator, Page } from "@playwright/test";

export const DEV_STAFF_EMAIL =
  process.env.E2E_STAFF_EMAIL ?? "thomas@bookkeepingconroe.com";

// Authentication is shared in memory within a worker; each test still gets a
// fresh browser context and fresh localStorage. No auth-state file is exported.
let staffCookies: Cookie[] | undefined;

/** Sign in through the local dev-bypass credentials provider. */
export async function signInAsStaff(page: Page) {
  if (staffCookies) {
    await page.context().addCookies(staffCookies);
    return;
  }
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', DEV_STAFF_EMAIL);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 60_000,
    waitUntil: "domcontentloaded",
  });
  staffCookies = await page.context().cookies();
}

/** Probe server availability before browser QA. Callers assert this is true. */
export async function serverIsUp(baseURL: string | undefined) {
  if (!baseURL) return false;
  try {
    const res = await fetch(`${baseURL}/login`, {
      signal: AbortSignal.timeout(15000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const channel = (value: number) => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luminance = ([r, g, b]: number[]) =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

const parseRgb = (value: string) =>
  (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);

/** WCAG relative-contrast ratio between two computed `rgb()` strings. */
export function contrastRatio(foreground: string, background: string) {
  const a = luminance(parseRgb(foreground));
  const b = luminance(parseRgb(background));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * Resolve the painted background behind an element, walking past transparent
 * ancestors the way a viewer's eye does. Takes a Locator so callers can use
 * Playwright's engines (`:has-text`, roles) rather than raw CSS.
 */
export async function effectiveColors(target: Locator) {
  return target.evaluate((el) => {
    const color = getComputedStyle(el).color;
    let node: Element | null = el;
    let background = "rgba(0, 0, 0, 0)";
    while (node) {
      const bg = getComputedStyle(node).backgroundColor;
      if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
        background = bg;
        break;
      }
      node = node.parentElement;
    }
    if (background === "rgba(0, 0, 0, 0)") background = "rgb(255, 255, 255)";
    return { color, background };
  });
}

/**
 * Navigate and wait until the keyboard layer is actually listening.
 *
 * `domcontentloaded` fires long before React hydrates — especially in dev, where
 * a cold route compile takes several seconds — so a keypress sent right after a
 * goto lands before the global listener exists and is silently lost. The
 * provider sets `data-keyboard-ready` on <html> once it is mounted.
 */
export async function gotoReady(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("html[data-keyboard-ready]", { timeout: 60_000 });
}

/** Options inside the command menu, excluding any native <select> on the page. */
export function menuOptions(page: Page) {
  return page.locator('#command-menu-list [role="option"]');
}
