import { defineConfig, devices } from "@playwright/test";

// Browser QA for staff-facing builder screens.
//
// Use an existing dev server so Prisma generation cannot conflict with a server
// on Windows. Start it yourself with npm run dev; an unavailable server fails QA.
export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
