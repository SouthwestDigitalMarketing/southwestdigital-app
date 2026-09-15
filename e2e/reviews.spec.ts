import { expect, test } from "@playwright/test";
import {
  deleteReviewRequest,
  disconnectReviewFixture,
  seedPublicReviewRequest,
} from "./reviewFixture";
import { gotoReady, serverIsUp, signInAsStaff } from "./support";

/**
 * Browser coverage for review requests.
 *
 * Never click Send or Send Reminder. Those buttons call the live server
 * action; .env.local on this machine would text a real number.
 */
test.describe("review requests", () => {
  test.beforeEach(async ({ baseURL }) => {
    expect(await serverIsUp(baseURL), "Start a dev server before running browser checks").toBe(true);
  });

  test.afterAll(async () => {
    await disconnectReviewFixture();
  });

  test("staff send dialog shows name, phone, and consent without sending", async ({ page }) => {
    await signInAsStaff(page);
    await gotoReady(page, "/reviews");

    await expect(page.getByRole("heading", { name: "Review requests" })).toBeVisible();
    await page.getByRole("button", { name: "Send Review Request" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Request a review" })).toBeVisible();
    await expect(dialog.getByLabel("Recipient name")).toBeVisible();
    await expect(dialog.getByLabel("Phone number")).toBeVisible();
    await expect(
      dialog.getByRole("checkbox", { name: /permission to text this number/i }),
    ).toBeVisible();
    await expect(dialog.getByText("Link will use this brand’s verified domain.")).toBeVisible();

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("public review page asks for a star rating then private reasons under 5", async ({ page }) => {
    const fixture = await seedPublicReviewRequest();
    try {
      const response = await page.goto(`/r/${fixture.token}`, { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBe(200);
      const wordmark = page.locator("img.brand-asset-fit");
      if ((await wordmark.count()) > 0) {
        await expect(wordmark).toBeVisible();
        await expect(page.getByText(fixture.brandName, { exact: true })).toHaveCount(0);
      } else {
        await expect(page.getByText(fixture.brandName, { exact: true }).first()).toBeVisible();
      }
      await expect(page.getByText(/how would you rate/i)).toBeVisible();
      await expect(page.getByRole("button", { name: "Leave a Google review" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Share private feedback" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Rate 5 out of 5" })).toBeVisible();

      await page.getByRole("button", { name: "Rate 4 out of 5" }).click();
      await expect(page.getByText(/thank you for your feedback/i)).toBeVisible();
      await expect(page.getByText("What kept this from being 5 stars?", { exact: true })).toBeVisible();
      await expect(page.getByText(/this stays with/i)).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Poor communication" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Slow turnaround time" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Pricing concerns" })).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Quality of work concerns" }),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Something else" })).toBeVisible();
      await expect(page.getByPlaceholder(/add more detail/i)).toBeVisible();
      const submit = page.getByRole("button", { name: "Submit" });
      await expect(submit).toBeDisabled();

      await page.getByRole("button", { name: "Poor communication" }).click();
      await page.getByRole("button", { name: "Pricing concerns" }).click();
      await expect(page.getByRole("button", { name: "Poor communication" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(page.getByRole("button", { name: "Pricing concerns" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(submit).toBeEnabled();

      await page.getByRole("button", { name: "Something else" }).click();
      await expect(page.getByPlaceholder(/tell us more/i)).toBeVisible();
      await expect(submit).toBeDisabled();
    } finally {
      await deleteReviewRequest(fixture.id, {
        brandId: fixture.brandId,
        googleRestore: fixture.googleRestore,
      });
    }
  });

  test("five stars on the public page opens the brand Google review URL", async ({ page }) => {
    const fixture = await seedPublicReviewRequest();
    try {
      await page.route(/google\./, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "text/html",
          body: "<html><body>google-review-destination</body></html>",
        });
      });
      await page.goto(`/r/${fixture.token}`, { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Rate 5 out of 5" }).click();
      await expect(page).toHaveURL(/google\./, { timeout: 15_000 });
    } finally {
      await deleteReviewRequest(fixture.id, {
        brandId: fixture.brandId,
        googleRestore: fixture.googleRestore,
      });
    }
  });

  test("public review page exposes OG title and composed og:image", async ({ page }) => {
    const fixture = await seedPublicReviewRequest();
    try {
      await page.goto(`/r/${fixture.token}`, { waitUntil: "domcontentloaded" });
      const ogTitle = page.locator('meta[property="og:title"]');
      await expect(ogTitle).toHaveAttribute("content", `Review ${fixture.brandName}`);
      const ogImage = page.locator('meta[property="og:image"]');
      await expect(ogImage).toHaveAttribute("content", /opengraph-image/i);
      const imageUrl = await ogImage.getAttribute("content");
      expect(imageUrl).toBeTruthy();
      const imageResponse = await page.request.get(imageUrl!);
      expect(imageResponse.status()).toBe(200);
      expect(imageResponse.headers()["content-type"]).toMatch(/image\/png/i);
    } finally {
      await deleteReviewRequest(fixture.id, {
        brandId: fixture.brandId,
        googleRestore: fixture.googleRestore,
      });
    }
  });

  test("unknown public token is 404", async ({ page }) => {
    const response = await page.goto("/r/e2e-review-missing-token-zzzz", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBe(404);
  });
});
