import { test, expect } from "@playwright/test";
import { serverIsUp, signInAsStaff } from "./support";

// Exercise local preview state only; never save or publish an offer.
for (const proposalMode of ["light", "dark"] as const) {
  test(`${proposalMode}: all inclusions share one section and higher tiers show their additions`, async ({ page, baseURL }) => {
    expect(await serverIsUp(baseURL)).toBe(true);
    await signInAsStaff(page);
    await page.goto("/offer-preview", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Staff preview — nothing here will be recorded.")).toBeVisible();
    await page.evaluate((mode) => {
      const key = "proposal-app-demo-assessment-v14";
      const saved = JSON.parse(window.localStorage.getItem(key) ?? "{}");
      const service = (id: string, name: string, defaultPackageIds: string[], includedPlacement = "main") => ({
        id, name, description: `${name} details`, defaultPackageIds,
        archived: false, billingCadence: "monthly", includedPlacement,
      });
      window.localStorage.setItem(key, JSON.stringify({
        ...saved, servicesInitialized: true, proposalMode: mode,
        packageNames: { maintain: "Maintain", improve: "Improve", grow: "Grow" },
        heroContinueButton: { label: "View packages", visible: true, icon: "", iconPlacement: "none" },
        additionalOptions: [{
          id: "extra", name: "Optional consultation", description: "Details",
          monthlyPrice: 50, billingCadence: "monthly", showInProposal: true,
          archived: false, packageIds: ["grow"],
        }],
        bonusPackageSelections: {},
        bonuses: [
          service("monthly-bookkeeping", "Monthly Bookkeeping", ["maintain", "improve", "grow"]),
          service("reports", "Monthly reports", ["maintain", "improve", "grow"]),
          service("forecast", "Cash flow forecast", ["improve", "grow"]),
          service("planning", "Annual planning", ["grow"]),
          service("standard", "Standard Client Support", ["maintain"]),
          service("priority", "Priority Client Support", ["improve"], "included"),
          service("concierge", "Concierge Client Support", ["grow"]),
          { ...service("setup", "Included setup", ["maintain", "improve", "grow"]), billingCadence: "one-time" },
          { ...service("onetime-extra", "Annual setup", ["grow"]), billingCadence: "one-time" },
        ],
      }));
    }, proposalMode);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "View packages", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Select your services" })).toBeVisible();

    const bannerTops: number[] = [];
    for (const name of ["Maintain", "Improve", "Grow"]) {
      const card = page.locator("section.grid").filter({ has: page.getByRole("heading", { name, exact: true }) });
      const recurring = card.locator(":scope > section").filter({ has: page.getByText("Recurring services", { exact: true }) });
      await expect(recurring).toHaveText("Recurring services");
      await expect(recurring.locator("xpath=following-sibling::*[1]")).toHaveCSS("border-top-width", "0px");
      const banner = card.getByText("Included with this package", { exact: true });
      await expect(banner).toBeVisible();
      bannerTops.push((await banner.boundingBox())!.y);
      const included = banner.locator("..");
      const oneTime = card.locator(":scope > section").filter({ has: page.getByText("One-time services", { exact: true }) });
      await expect(oneTime).not.toContainText("Included setup");
      await expect(oneTime).not.toContainText("Annual setup");
      await expect(card.getByText("Included services are listed above.")).toHaveCount(0);

      if (name === "Maintain") {
        for (const service of ["Monthly Bookkeeping", "Monthly reports", "Included setup", "Standard Client Support"]) {
          await expect(included.getByText(service, { exact: true })).toHaveCount(1);
        }
        await expect(included.getByText("QBO", { exact: true })).toBeVisible();
      } else {
        await expect(included).toContainText(`Everything included with ${name === "Improve" ? "Maintain" : "Improve"}, plus:`);
        await expect(included).not.toContainText("Monthly reports");
        await expect(included).not.toContainText("Included setup");
        await expect(included).toContainText(name === "Improve" ? "Cash flow forecast" : "Annual planning");
      }
      if (name === "Improve") {
        await expect(included).toContainText("Priority Client Support");
      }
      if (name === "Grow") {
        await expect(included).toContainText("Concierge Client Support");
        await expect(included).toContainText("Annual setup");
        await expect(included).not.toContainText("Cash flow forecast");
        const optional = card.getByText("Optional add-ons", { exact: true }).locator("..");
        await expect(optional).toContainText("Optional consultation");
        await expect(included).not.toContainText("Optional consultation");
      }
    }
    // A missing optional-add-on section must not shift a card's shared grid rows.
    expect(Math.max(...bannerTops) - Math.min(...bannerTops)).toBeLessThan(2);
  });
}
