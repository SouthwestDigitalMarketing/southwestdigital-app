#!/usr/bin/env node
// Run on Ripley under flock after the Sales leads hub is registered in the All Thing.
// The database event is authoritative; a marker makes retries safe after a crash.
import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, realpathSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";

const root = process.env.ALL_THING_ROOT;
if (hostname() !== "ripley" || !root || realpathSync(root) !== "/home/tom/vaults/all-thing") {
  throw new Error("All Thing writer requires the canonical Ripley checkout");
}
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
if (git("branch", "--show-current") !== "main") throw new Error("All Thing checkout must be on main");
const hubPath = "hubs/sales-leads.md";
if (!existsSync(join(root, hubPath))) throw new Error("Sales leads hub has not been registered");

const prisma = new PrismaClient();
const footer = "---\n*Changing this page? Read [[updating-the-all-thing]] first.*";
const text = (value) => String(value ?? "").replace(/[\r\n]+/g, " ").trim();
const slug = (value) => text(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
const today = () => new Date().toISOString().slice(0, 10);

function requireClean(paths) {
  const dirty = git("status", "--porcelain", "--", ...paths);
  if (dirty) throw new Error(`All Thing paths are already being edited: ${dirty.split("\n").map(x => x.slice(3)).join(", ")}`);
}

function insertUnder(content, heading, line) {
  if (content.includes(line)) return content;
  const position = content.indexOf(heading);
  if (position < 0) throw new Error(`Missing heading ${heading}`);
  const after = content.indexOf("\n", position) + 1;
  return content.slice(0, after) + "\n" + line + content.slice(after);
}

async function process(job) {
  const event = job.event;
  if (!event.leadId) throw new Error("Event has no lead link; needs identity review");
  const lead = await prisma.meetingLead.findUnique({ where: { id: event.leadId }, select: { id: true, name: true, company: true, brandId: true } });
  const brand = await prisma.brand.findUnique({ where: { id: event.brandId }, select: { slug: true, name: true } });
  if (!lead || !brand || lead.brandId !== event.brandId) throw new Error("Brand or lead link is missing");

  const pageSlug = `lead-${slug(brand.slug)}-${slug(lead.name)}-${lead.id}`;
  const pagePath = `entities/${pageSlug}.md`;
  const paths = [pagePath, hubPath, "index.md", "log.md"];
  requireClean(paths);
  const absolute = join(root, pagePath);
  const marker = `<!-- swapp-event:${event.id} -->`;
  const date = event.occurredAt.toISOString().slice(0, 10);
  const entry = `### ${date} — ${text(event.eventType)}\n\n${text(event.summary)}\n\nSource: SWapp ${text(event.sourceRef ?? `/leads/${lead.id}`)} · ${text(event.source)}:${text(event.sourceEventId)}\n${marker}\n`;
  const existed = existsSync(absolute);
  let page = existed ? readFileSync(absolute, "utf8") :
    `---\ntitle: ${JSON.stringify(`${lead.name} (lead)`)}\ncreated: ${today()}\nupdated: ${today()}\ntype: entity\ntags: [sales, lead]\nsources: []\nup: sales-leads\n---\n\n# ${text(lead.name)}\n\nLead for [[${slug(brand.name)}]]. Parent: [[sales-leads]].\n\n## Current\n\n${text(event.summary)}\n\n## Diary\n\n${footer}\n`;
  if (!page.includes(marker)) {
    if (existed) {
      if (!page.includes("## Diary\n")) throw new Error(`Existing lead page lacks Diary heading: ${pagePath}`);
      page = page.replace(/^(updated: )\d{4}-\d{2}-\d{2}/m, `$1${today()}`);
      page = page.replace(/(## Current\n\n)[\s\S]*?(\n## Diary\n)/, `$1${text(event.summary)}\n$2`);
    }
    page = page.replace("## Diary\n", `## Diary\n\n${entry}\n`);
    writeFileSync(absolute, page);
  }
  if (!existed) {
    const hub = join(root, hubPath), index = join(root, "index.md");
    writeFileSync(hub, insertUnder(readFileSync(hub, "utf8"), "## Under this hub", `- [[${pageSlug}]] — ${text(lead.name)} (${text(brand.name)}).`));
    writeFileSync(index, insertUnder(readFileSync(index, "utf8"), "## Entities", `- [[${pageSlug}]] — ${text(lead.name)} sales history.`));
  }
  const log = join(root, "log.md");
  const logLine = `\n## [${today()}] update | SWapp sales event ${event.id}\n- ${text(event.eventType)} for ${text(lead.name)} (${text(brand.name)}).\n`;
  if (!readFileSync(log, "utf8").includes(`SWapp sales event ${event.id}`)) writeFileSync(log, readFileSync(log, "utf8") + logLine);

  execFileSync("python3", ["_meta/lint.py"], { cwd: root, stdio: "pipe" });
  if (git("status", "--porcelain", "--", ...paths)) {
    git("add", "--", ...paths);
    git("commit", "-m", `Record SWapp sales event ${event.id}`, "--", ...paths);
  }
  git("push", "origin", "main");
  if (!readFileSync(absolute, "utf8").includes(marker)) throw new Error("All Thing read-back lacks event marker");
  await prisma.allThingWriteJob.update({ where: { id: job.id }, data: { status: "done", completedAt: new Date(), lastError: null } });
}

try {
  const jobs = await prisma.allThingWriteJob.findMany({
    where: { status: { in: ["pending", "failed"] } },
    include: { event: true },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  for (const job of jobs) {
    try { await process(job); console.log(`Completed All Thing job ${job.id}`); }
    catch (error) {
      const message = String(error instanceof Error ? error.message : error).slice(0, 1000);
      await prisma.allThingWriteJob.update({ where: { id: job.id }, data: { status: "failed", attempts: { increment: 1 }, lastError: message } });
      console.error(`Failed All Thing job ${job.id}: ${message}`);
      break; // A shared checkout problem affects later jobs too.
    }
  }
} finally { await prisma.$disconnect(); }
