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
    paused: false,
    // The automatic Clean flows first; steps (the default) are clicked through later.
    settings: { steps: false },
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
      if (route.startsWith("/donna")) {
        assert.deepEqual(
          await page
            .locator('nav[aria-label="Donna sections"] a')
            .allTextContents(),
          ["Overview", "Current job", "Completed jobs", "Email"],
        );
        // Start new job lives on Current job only (Tom, 2026-11-26).
        await expect(page.getByRole("button", { name: "Start new job", exact: true })).toHaveCount(0);
      }
      if (route === "/donna/email") {
        await page
          .getByRole("heading", { name: "Zoho folders", exact: true })
          .waitFor();
        await page
          .getByRole("heading", { name: "Custom folders", exact: true })
          .waitFor();
      }
    }
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  async function pageBox(route, headingName) {
    await page.goto(base + route);
    await page
      .getByRole("heading", { name: headingName, exact: true })
      .waitFor();
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
  await page.goto(base + "/donna/current");
  await page.getByRole("button", { name: "Start new job", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Donna", exact: true }),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: /Clean inbox/ }),
  ).toBeEnabled();
  await expect(
    dialog.getByRole("button", { name: /Clean inbox/ }),
  ).toContainText("73");
  await expect(
    dialog.getByRole("button", { name: /Empty spam/ }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: /Empty spam/ }),
  ).toContainText("209");
  await expect(
    dialog.getByRole("button", { name: /Clear notifications/ }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: /Clear notifications/ }),
  ).toContainText("445");
  await expect(
    dialog.getByRole("button", { name: /Empty trash/ }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: /Empty trash/ }),
  ).toContainText("406");
  await expect(
    dialog.getByRole("button", { name: /Clean drafts/ }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: /Clean drafts/ }),
  ).toContainText("19");
  await expect(
    dialog.getByRole("button", { name: /Do it all/ }),
  ).toBeDisabled();
  await expect(dialog.getByRole("button", { name: /Do it all/ })).toContainText(
    "1,152",
  );
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto(base + "/donna/current");
  await page.getByRole("button", { name: "Start new job", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Clean inbox/ }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect
    .poll(async () =>
      db.donnaJob.count({
        where: { mailboxId: box.id, kind: "clean" },
      }),
    )
    .toBe(1);
  const cleanJob = await db.donnaJob.findFirstOrThrow({
    where: { mailboxId: box.id, kind: "clean" },
  });
  await expect(
    page.getByRole("link", { name: /Cleaning inbox/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Cleaning inbox/ }),
  ).toContainText("0 of 73");
  await expect(
    page.getByRole("link", { name: /Cleaning inbox/ }),
  ).toContainText("Waiting for Donna");
  await page.goto(base + "/dashboard");
  await expect(
    page.getByRole("link", { name: /Cleaning inbox/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Cleaning inbox/ }),
  ).toContainText("0 of 73");
  await page.getByRole("link", { name: /Cleaning inbox/ }).click();
  await expect(page).toHaveURL(base + "/donna/cleans/" + cleanJob.id);
  await expect(
    page.getByRole("heading", { name: "Inbox clean" }),
  ).toBeVisible();
  assert.deepEqual(cleanJob.options, { manual: true });
  // While a job runs, Current job opens it and offers no Start new job.
  await page.goto(base + "/donna/current");
  await expect(page).toHaveURL(base + "/donna/cleans/" + cleanJob.id);
  await expect(page.getByRole("button", { name: "Start new job", exact: true })).toHaveCount(0);
  // Cancel a queued check: the job ends and the bar goes away.
  await page.goto(base + "/donna/cleans/" + cleanJob.id);
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect
    .poll(async () =>
      (await db.donnaJob.findUniqueOrThrow({ where: { id: cleanJob.id } }))
        .status,
    )
    .toBe("cancelled");
  await page.reload();
  await expect(page.getByText("Cancelled before Donna moved anything.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Cleaning inbox/ })).toHaveCount(0);
  // A finished preview: untick one, approve the rest.
  const [keep, file] = ["a1".repeat(32), "b2".repeat(32)];
  const preview = await db.donnaJob.create({
    data: {
      mailboxId: box.id,
      kind: "clean",
      eventKey: "ui-preview",
      status: "done",
      completedAt: new Date(),
      options: { preview: true },
      result: {
        preview: true,
        at: new Date().toISOString(),
        reviewed: 3,
        remaining: 70,
        filed: [
          { thread: keep, subject: "Example keep", from: "a@shop.example", folder: "Newsletter" },
          { thread: file, subject: "Example file", from: "b@shop.example", folder: "Spam" },
        ],
        waiting: [],
        needsYou: [{ title: "Example question", nextAction: "Review draft" }],
        skipped: [{ subject: "Example client", reason: "known contact" }],
      },
    },
  });
  await page.goto(base + "/donna/cleans/" + preview.id);
  await expect(page.getByText("Donna would file")).toBeVisible();
  await expect(page.getByText("Not looked at yet 70")).toBeVisible();
  await page.getByRole("checkbox", { name: /Example keep/ }).uncheck();
  await page.getByRole("button", { name: "File the ticked emails" }).click();
  await expect(page.getByRole("heading", { name: "Inbox clean" })).toBeVisible();
  const real = await db.donnaJob.findFirstOrThrow({
    where: { mailboxId: box.id, kind: "clean", status: "pending" },
  });
  assert.deepEqual(real.options, {
    previewJobId: preview.id,
    plan: [{ thread: file, folder: "Spam" }],
  });
  await expect(page.getByRole("link", { name: /Cleaning inbox/ })).toBeVisible();
  await page.goto(base + "/donna/cleans/" + preview.id);
  await expect(page.getByRole("link", { name: /Already approved/ })).toBeVisible();
  await db.donnaJob.update({
    where: { id: real.id },
    data: {
      status: "done",
      completedAt: new Date(),
      result: {
        preview: false,
        at: new Date().toISOString(),
        reviewed: 0,
        remaining: 0,
        filed: [{ thread: file, subject: "Example file", from: "b@shop.example", folder: "Spam", messages: ["<x@y>"] }],
        waiting: [],
        needsYou: [],
        skipped: [],
      },
    },
  });
  await page.goto(base + "/donna/cleans/" + real.id);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByText(/Moving back to Inbox/)).toBeVisible();
  const undo = await db.donnaJob.findFirstOrThrow({
    where: { mailboxId: box.id, kind: "undo" },
  });
  assert.deepEqual(undo.options, { cleanJobId: real.id, threads: [file] });

  // Steps: start step 1 from the Overview, choose per bucket, start step 2.
  await db.donnaJob.updateMany({
    where: { mailboxId: box.id, status: { in: ["pending", "leased"] } },
    data: { status: "done", leaseToken: null, leaseUntil: null },
  });
  await db.donnaMailbox.update({ where: { id: box.id }, data: { settings: { steps: true } } });
  await page.goto(base + "/donna");
  // One button on the page; everything else waits under More.
  await expect(page.getByRole("button", { name: "Clean inbox now" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Pause Donna" })).toHaveCount(0);
  await expect(page.getByText(/More: status/)).toHaveCount(0);
  // One click collapses and expands the sidebar.
  {
    const phone = page.viewportSize();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
    await page.getByRole("button", { name: "Expand sidebar" }).click();
    await expect(page.getByRole("button", { name: "Collapse sidebar" })).toBeVisible();
    if (phone) await page.setViewportSize(phone);
  }
  await expect(page.getByRole("region", { name: "Zoho folders" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Custom folders" })).toBeVisible();
  // Start new job (on Current job) starts step 1.
  await page.goto(base + "/donna/current");
  await page.getByRole("button", { name: "Start new job", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Clean inbox/ }).click();
  const pendingClean = { where: { mailboxId: box.id, kind: "clean", status: "pending" } };
  await expect.poll(async () => Boolean(await db.donnaJob.findFirst(pendingClean))).toBe(true);
  const stepOne = await db.donnaJob.findFirstOrThrow(pendingClean);
  assert.deepEqual(stepOne.options, { preview: true, buckets: true, limit: 25 });
  await page.goto(base + "/donna");
  await expect(page.getByRole("link", { name: /Step 1: sorting Inbox into buckets/ })).toBeVisible();
  // The bar shows what Donna just did with each email.
  await db.donnaMailbox.update({
    where: { id: box.id },
    data: { coverage: { ...box.coverage, cleanProgress: { total: 25, done: 1, current: "Example next", phase: "working",
      recent: [{ subject: "Example progress update", result: "Clients (Rodan Properties): From Rodan Properties, a client in SWapp" }] } } },
  });
  await page.reload();
  await expect(page.getByRole("list", { name: "Just handled" })).toContainText("Example progress update → Clients (Rodan Properties)");
  // Current job tab opens the running job; it shows buckets filling in.
  await db.donnaJob.update({
    where: { id: stepOne.id },
    data: { result: { preview: true, live: true, at: new Date().toISOString(), reviewed: 1,
      sorted: [{ thread: "ab".repeat(32), subject: "Example live email", from: "x@shop.example", bucket: "Newsletter", why: "Promo", suggest: "Newsletter" }] } },
  });
  await page.getByRole("link", { name: "Current job" }).click();
  await expect(page).toHaveURL(new RegExp("/donna/cleans/" + stepOne.id));
  await expect(page.getByRole("link", { name: "Current job" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("table", { name: "Sorted emails" })).toContainText("Newsletter (1)");
  await expect(page.getByRole("table", { name: "Sorted emails" })).toContainText("Example live email");
  // Why is a hover icon, not a column of text.
  await expect(page.getByRole("img", { name: "Why: Promo" })).toHaveAttribute("title", "Promo");
  await expect(page.getByRole("table", { name: "Sorted emails" })).not.toContainText("Promo");
  await page.goto(base + "/donna");
  // Pause/Resume and Stop sit in the top status bar.
  const bar = page.locator("div", { has: page.getByRole("link", { name: /Step 1: sorting Inbox into buckets/ }) }).last();
  await bar.getByRole("button", { name: "Pause" }).click();
  await expect.poll(async () => (await db.donnaMailbox.findUnique({ where: { id: box.id } })).paused).toBe(true);
  await bar.getByRole("button", { name: "Resume" }).click();
  await expect.poll(async () => (await db.donnaMailbox.findUnique({ where: { id: box.id } })).paused).toBe(false);
  await bar.getByRole("button", { name: "Stop" }).click();
  await expect.poll(async () => (await db.donnaJob.findUnique({ where: { id: stepOne.id } })).status).toBe("cancelled");
  await expect(page.getByRole("link", { name: /Step 1: sorting Inbox into buckets/ })).toHaveCount(0);
  const [notice, promoA, promoB, rodan] = ["c3".repeat(32), "d4".repeat(32), "e5".repeat(32), "f6".repeat(32)];
  await db.donnaJob.update({
    where: { id: stepOne.id },
    data: {
      status: "done",
      completedAt: new Date(),
      result: {
        preview: true, at: new Date().toISOString(), reviewed: 3, remaining: 0,
        filed: [], waiting: [], needsYou: [], skipped: [],
        sorted: [
          { thread: promoA, subject: "Example sale A", from: "a@shop.example", bucket: "Newsletter", why: "Promo A", suggest: "Newsletter" },
          { thread: notice, subject: "Example final notice", from: "n@bank.example", bucket: "Money and legal", why: "Money or legal trouble", suggest: null },
          { thread: promoB, subject: "Example sale B", from: "b@shop.example", bucket: "Newsletter", why: "Promo B", suggest: "Newsletter" },
          { thread: rodan, subject: "Example progress update", from: "dan@rodan.example", bucket: "Clients", why: "From Rodan Properties, a client in SWapp", suggest: null, client: "Rodan Properties" },
        ],
      },
    },
  });
  // A finished step 1 is opened from the Jobs tab.
  await page.goto(base + "/donna/jobs");
  await page.getByRole("link", { name: /4 sorted into 3 buckets/ }).click();
  await expect(page.getByRole("heading", { name: "Step 1: Inbox sorted into buckets" })).toBeVisible();
  await expect(page.getByText("Why: Money or legal trouble")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start step 2" })).toBeDisabled();
  await page.getByLabel("What to do with Newsletter").selectOption("Newsletter");
  await page.getByRole("checkbox", { name: /Example sale B/ }).uncheck();
  await page.getByLabel("What to do with Clients").selectOption("tag:Archive");
  await expect(
    page.getByText("Step 2 will tag with the client name: 1; move to Archive: 1; move to Newsletter: 1. Everything else stays as it is."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start step 2" }).click();
  await expect(page.getByRole("heading", { name: "Step 2: what Donna moved" })).toBeVisible();
  const stepTwo = await db.donnaJob.findFirstOrThrow(pendingClean);
  assert.deepEqual(stepTwo.options, {
    previewJobId: stepOne.id,
    plan: [
      { thread: rodan, folder: "Archive", tag: "Rodan Properties" },
      { thread: promoA, folder: "Newsletter" },
    ],
    buckets: true,
  });
  await db.donnaJob.updateMany({ where: { id: stepTwo.id }, data: { status: "done" } });
  // Jobs tab lists every job; each opens its report.
  await page.goto(base + "/donna/jobs");
  const jobs = page.getByRole("list", { name: "Completed jobs" });
  await expect(jobs).toContainText("Step 1: sort Inbox into buckets");
  await expect(jobs).toContainText("4 sorted into 3 buckets");
  await expect(jobs).toContainText("Step 2: do what you chose");
  await page.goto(base + "/donna/current");
  await expect(page.getByText("No job is running.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start new job", exact: true })).toBeVisible();
  for (const size of [
    { width: 360, height: 640 },
    { width: 412, height: 915 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(size);
    for (const id of [preview.id, real.id]) {
      await page.goto(base + "/donna/cleans/" + id);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        true,
        `No sideways scroll on the clean page at ${size.width}px`,
      );
    }
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
    "Donna UI checks passed: Overview/Email tabs, Clean check/cancel/approve/undo, steps 1 and 2 with bucket choices and client tags, bar Pause/Resume/Stop, Current job and Jobs tabs, above-fold layouts at 360x640 / 412x915 / 1280x800, request edit/direction/completion, settings and counts-only Scorecard privacy.",
  );
} finally {
  await browser.close();
  await db.donnaMailbox.deleteMany({ where: { id: box.id } });
  await db.$disconnect();
}
