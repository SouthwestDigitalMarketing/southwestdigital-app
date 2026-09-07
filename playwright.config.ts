import { defineConfig, devices } from "@playwright/test";

// Browser QA for staff-facing builder screens.
//
// No `webServer` block on purpose: `npm run dev` runs `prisma generate` first,
// which hits the known Windows EPERM lock when another dev server already holds
// query_engine-windows.dll.node. Start the dev server yourself, then run
// `npm run test:e2e`. Specs skip themselves when nothing is listening.
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
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
