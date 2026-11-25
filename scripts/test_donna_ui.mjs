// Local-only click-through. Uses and removes its own clearly labelled fixtures.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";

const database = new URL(process.env.DATABASE_URL ?? "");
if (database.hostname !== "127.0.0.1" || database.pathname !== "/swapp_donna")
  throw new Error("Use the isolated local swapp_donna database.");
const base = "http://100.98.89.93:3130";
const db = new PrismaClient();
const brand = await db.brand.findUniqueOrThrow({
  where: { slug: "bookkeeping-conroe" },
});
const box = await db.donnaMailbox.create({
  data: {
    brandId: brand.id,
    key: "ui-" + randomBytes(8).toString("hex"),
    address: "example@example.com",
    paused: true,
    hookKey: randomBytes(32).toString("hex"),
  },
});
const now = new Date();
const request = await db.donnaRequest.create({
  data: {
    mailboxId: box.id,
    sourceKey: "example-ui-request",
    sourceVersion: "example-v1",
    title: "Example UI check",
    person: "Example client",
    category: "client",
    owner: "Donna",
    summary: "Example source request.",
    recommendation: "Review the prepared response.",
    nextAction: "Review reply",
    firstReceivedAt: now,
    evidence: [
      {
        key: "example-message",
        from: "client@example.com",
        subject: "Example",
        at: now.toISOString(),
        excerpt: "Example source evidence.",
        folder: "INBOX",
        attachments: ["example.pdf"],
      },
    ],
    draft: {
      from: "example@example.com",
      to: ["client@example.com"],
      cc: [],
      subject: "Re: Example",
      body: "Example prepared response.",
      attachments: [],
    },
  },
});
const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base + "/login");
  await page.getByRole("textbox").first().fill("thomas@bookkeepingconroe.com");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  for (const tab of ["needs-you", "working", "waiting", "handled"]) {
    await page.goto(base + "/donna?tab=" + tab);
    await page.getByRole("heading", { name: "Donna", exact: true }).waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      tab + " overflows",
    );
  }
  await page.goto(base + "/donna/requests/" + request.id);
  for (const section of [
    "What they need",
    "Donna recommends",
    "Prepared work",
    "Conversation and files",
    "Activity",
  ])
    await page.getByRole("heading", { name: section, exact: true }).waitFor();
  await page
    .getByLabel("Edit reply", { exact: true })
    .fill("Example revised response.");
  await page.getByRole("button", { name: "Save reply", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await db.donnaRequest.findUnique({ where: { id: request.id } })).draft
          .body,
    )
    .toBe("Example revised response.");
  await page
    .getByLabel("What should Donna do?")
    .fill("Example: review the attachment.");
  await page
    .getByRole("button", { name: "Give direction", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await db.donnaRequest.findUnique({ where: { id: request.id } }))
          .direction,
    )
    .toBe("Example: review the attachment.");
  await page
    .getByText("Update follow-up or completion", { exact: true })
    .click();
  await page
    .getByLabel("Waiting on, next action, or evidence the work is finished")
    .fill("Example work verified complete by this UI check.");
  await page
    .getByRole("button", { name: "Mark finished with evidence", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await db.donnaRequest.findUnique({ where: { id: request.id } })).state,
    )
    .toBe("handled");
  await page.goto(base + "/donna/settings");
  await page
    .getByRole("heading", { name: "Donna settings", exact: true })
    .waitFor();
  await page.goto(base + "/donna/activity");
  await page
    .getByRole("heading", { name: "Donna scorecard", exact: true })
    .waitFor();
  await context.addCookies([{ name: "swapp_privacy", value: "1", url: base }]);
  await page.reload();
  await page
    .getByText("Privacy mode: counts only. Email details are hidden.")
    .waitFor();
  assert.equal(await page.locator("details").count(), 0);
  await context.addCookies([{ name: "swapp_privacy", value: "0", url: base }]);
  await db.donnaMailbox.delete({ where: { id: box.id } });
  const artifacts = homedir() + "/.local/share/swapp-donna-dev";
  await mkdir(artifacts, { recursive: true, mode: 0o700 });
  await page.goto(base + "/donna");
  await page.getByRole("heading", { name: "Donna", exact: true }).waitFor();
  await page.screenshot({
    path: artifacts + "/mobile-desk.png",
    fullPage: true,
    caret: "initial",
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: artifacts + "/desktop-desk.png",
    fullPage: true,
    caret: "initial",
  });
  assert.deepEqual(errors, []);
  console.log(
    "Donna UI checks passed: four tabs, request evidence, edit reply, give direction, complete with evidence, settings, counts-only privacy and mobile/desktop layout.",
  );
} finally {
  await browser.close();
  await db.donnaMailbox.deleteMany({ where: { id: box.id } });
  await db.$disconnect();
}
