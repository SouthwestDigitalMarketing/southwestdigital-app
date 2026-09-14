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

  test("public review page renders brand and choice UI for a seeded token", async ({ page }) => {
    const fixture = await seedPublicReviewRequest();
    try {
      const response = await page.goto(`/r/${fixture.token}`, { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBe(200);
      await expect(page.getByText(fixture.brandName, { exact: true }).first()).toBeVisible();
      await expect(page.getByText(/how was your experience/i)).toBeVisible();
      await expect(page.getByText(/5-star/i)).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Leave a Google review" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Share private feedback" })).toBeVisible();

      await page.getByRole("button", { name: "Share private feedback" }).click();
      await expect(page.getByText("Share private feedback")).toBeVisible();
      await expect(page.getByRole("button", { name: "Leave a Google review" })).toHaveCount(0);
    } finally {
      await deleteReviewRequest(fixture.id);
    }
  });

  test("unknown public token is 404", async ({ page }) => {
    const response = await page.goto("/r/e2e-review-missing-token-zzzz", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBe(404);
  });
});
