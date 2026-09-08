import { test, expect, type Page } from "@playwright/test";
import { contrastRatio, effectiveColors, serverIsUp, signInAsStaff } from "./support";

// The staff-preview banner sits on `bg-amber-50`, which the dark rules in
// globals.css repaint to a near-black amber. Its ink is `text-amber-900` /
// `text-amber-800`, which those rules did NOT lighten - so the banner rendered
// dark-on-dark. These measure the painted colours in both proposal modes.
const ASSESSMENT_KEY = "proposal-app-demo-assessment-v14";
const WCAG_AA_BODY = 4.5;

async function openPreviewInMode(page: Page, mode: "light" | "dark") {
  await page.goto("/offer-preview", { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ([key, proposalMode]) => {
      const raw = window.localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : {};
      window.localStorage.setItem(key, JSON.stringify({ ...parsed, proposalMode }));
    },
    [ASSESSMENT_KEY, mode] as const,
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("Staff preview — nothing here will be recorded.")).toBeVisible({
    timeout: 30_000,
  });
}

test.describe("Staff preview banner is legible in both proposal modes", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    expect(await serverIsUp(baseURL), `Start a dev server on ${baseURL} before browser QA`).toBe(true);
    await signInAsStaff(page);
  });

  for (const mode of ["light", "dark"] as const) {
    test(`${mode} mode keeps the banner above WCAG AA`, async ({ page }) => {
      await openPreviewInMode(page, mode);

      // The heading carries text-amber-900 on the same element as bg-amber-50;
      // the body carries text-amber-800 as a descendant. Different specificity
      // paths, so both need checking.
      const heading = page.getByText("Staff preview — nothing here will be recorded.");
      const body = page.getByText(/interactive simulation of the client experience/);

      for (const [label, target] of [["heading", heading], ["body", body]] as const) {
        const { color, background } = await effectiveColors(target);
        const ratio = contrastRatio(color, background);
        // eslint-disable-next-line no-console
        console.log(`${mode}/${label}: ${color} on ${background} = ${ratio.toFixed(2)}:1`);
        expect(ratio, `${mode} mode ${label} contrast (${color} on ${background})`).toBeGreaterThan(
          WCAG_AA_BODY,
        );
      }
    });
  }
});
