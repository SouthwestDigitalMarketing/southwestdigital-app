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
    coverage: {
      folders: [
        { folder: "INBOX", messages: 73 },
        { folder: "Drafts", messages: 19 },
        { folder: "Templates", messages: 0 },
        { folder: "Snoozed", messages: 0 },
        { folder: "Sent", messages: 546 },
        { folder: "Spam", messages: 209 },
        { folder: "Trash", messages: 406 },
        { folder: "Notification", messages: 445 },
        { folder: "Newsletter", messages: 451 },
        { folder: "Archive", messages: 634 },
        { folder: "Cold Outreach", messages: 226 },
        { folder: "App Notices", messages: 0 },
        { folder: "DMARC", messages: 82 },
        { folder: "Personal", messages: 21 },
        { folder: "Bills", messages: 7 },
        { folder: "Payments", messages: 11 },
      ],
      message_locations: 3130,
      remaining_threads: 1932,
    },
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
    summary: "Example source request. ".repeat(40),
    recommendation: "Review the prepared response. ".repeat(30),
    nextAction: "Review reply",
    firstReceivedAt: now,
    evidence: [
      {
        key: "example-message",
        from: "client@example.com",
        subject: "Example",
        at: now.toISOString(),
        excerpt: "Example source evidence. ".repeat(20),
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
  const withoutJavaScript = await browser.newContext({
    storageState: await context.storageState(),
    javaScriptEnabled: false,
  });
  const serverPage = await withoutJavaScript.newPage();
  await serverPage.goto(
    base + "/donna/requests/" + request.id + "?section=reply",
  );
  await expect(
    serverPage.getByLabel("Edit reply", { exact: true }),
  ).toBeDisabled();
  await withoutJavaScript.close();
  const routes = [
    "/scorecard",
    ...["overview", "sorting", "replies", "requests", "quality"].map(
      (g) => "/scorecard/email?group=" + g,
    ),
    "/scorecard/email?kind=reviewed",
    "/donna",
    "/donna/email",
    ...["needs-you", "working", "waiting", "handled"].map(
      (s) => "/donna/email/work?state=" + s,
    ),
    ...["mailbox", "connection", "coverage", "rules"].map(
      (s) => "/donna/settings?section=" + s,
    ),
    ...[
      "summary",
      "reply",
      "source",
      "activity",
      "direction",
      "manage",
      "full",
    ].map((s) => "/donna/requests/" + request.id + "?section=" + s),
  ];
  for (const viewport of [
    { width: 360, height: 640 },
    { width: 412, height: 915 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    for (const route of routes) {
      await page.goto(base + route);
      await page
        .getByRole("heading", {
          name: route.startsWith("/donna")
            ? "Donna"
            : route === "/scorecard"
              ? "Scorecard"
              : "Email scorecard",
          exact: true,
        })
        .waitFor();
      const size = await page.evaluate(() => ({
        height: document.documentElement.scrollHeight,
        width: document.documentElement.scrollWidth,
        viewportHeight: innerHeight,
        viewportWidth: innerWidth,
      }));
      assert.ok(
        size.width <= size.viewportWidth + 1,
        route + " overflows horizontally at " + viewport.width,
      );
      assert.ok(
        size.height <= size.viewportHeight + 2,
        route +
          " extends below fold at " +
          viewport.width +
          "x" +
          viewport.height +
          ": " +
          JSON.stringify(size),
      );
      if (route.startsWith("/donna"))
        assert.deepEqual(
          await page
            .locator('nav[aria-label="Donna sections"] a')
            .allTextContents(),
          ["Overview", "Email"],
        );
      if (route === "/donna/email")
        await page.getByLabel("Mailbox folders", { exact: true }).waitFor();
    }
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  async function pageBox(route, headingName) {
    await page.goto(base + route);
    await page.getByRole("heading", { name: headingName, exact: true }).waitFor();
    return page.evaluate((name) => {
      const main = document.getElementById("main-content");
      const heading = [...(main?.querySelectorAll("h1, h2") ?? [])].find(
        (h) => h.textContent.trim() === name,
      );
      let box = heading;
      while (
        box &&
        box.parentElement &&
        box.parentElement.id !== "main-content"
      ) {
        box = box.parentElement;
      }
      return {
        main: main?.clientWidth ?? 0,
        box: box?.clientWidth ?? 0,
        maxWidth: box ? getComputedStyle(box).maxWidth : "",
        className: typeof box?.className === "string" ? box.className : "",
      };
    }, headingName);
  }
  const clientsWidth = await pageBox("/clients", "Client directory");
  for (const [route, heading] of [
    ["/donna", "Donna"],
    ["/donna/email", "Donna"],
    ["/scorecard", "Scorecard"],
  ]) {
    const measure = await pageBox(route, heading);
    assert.equal(
      measure.maxWidth,
      "none",
      route + " still has a max-width: " + JSON.stringify(measure),
    );
    assert.ok(
      Math.abs(measure.box - measure.main) <= 2,
      route + " does not fill the shell: " + JSON.stringify(measure),
    );
    assert.ok(
      Math.abs(measure.box - clientsWidth.box) <= 2,
      route +
        " width differs from Clients: " +
        JSON.stringify({ measure, clientsWidth }),
    );
  }
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto(base + "/donna/requests/" + request.id + "?section=reply");
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
  for (const body of ["First quick edit.", "Second quick edit."]) {
    await page.goto(base + "/donna/requests/" + request.id + "?section=reply");
    await page.getByLabel("Edit reply", { exact: true }).fill(body);
    await page.getByRole("button", { name: "Save reply", exact: true }).click();
    await expect
      .poll(
        async () =>
          (
            await db.donnaRequest.findUniqueOrThrow({
              where: { id: request.id },
            })
          ).draft.body,
      )
      .toBe(body);
  }
  await page.goto(
    base + "/donna/requests/" + request.id + "?section=direction",
  );
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
  await page.goto(base + "/donna/requests/" + request.id + "?section=manage");
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
  await page.goto(base + "/scorecard/email");
  await page
    .getByRole("heading", { name: "Email scorecard", exact: true })
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
    "Donna UI checks passed: Overview/Email tabs, above-fold layouts at 360x640 / 412x915 / 1280x800, request edit/direction/completion, settings and counts-only Scorecard privacy.",
  );
} finally {
  await browser.close();
  await db.donnaMailbox.deleteMany({ where: { id: box.id } });
  await db.$disconnect();
}
