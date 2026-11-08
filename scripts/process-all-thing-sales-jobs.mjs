#!/usr/bin/env node
// Ripley-only worker. Run under flock after the Sales lead-file contract is agreed.
import { PrismaClient } from "@prisma/client";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, realpathSync, mkdirSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";

const root = process.env.ALL_THING_ROOT;
if (hostname() !== "ripley" || !root || realpathSync(root) !== "/home/tom/vaults/all-thing") throw new Error("Canonical Ripley All Thing required");
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
if (git("branch", "--show-current") !== "main") throw new Error("All Thing checkout must be on main");
git("fetch", "origin");
if (git("rev-parse", "HEAD") !== git("rev-parse", "origin/main")) throw new Error("All Thing main is behind origin/main");
if (!existsSync(join(root, "hubs/leads.md")) || !existsSync(join(root, "sops/sop-lead-file.md"))) throw new Error("Lead hub and SOP are required");
const prisma = new PrismaClient();
const footer = "---\n*Changing this page? Read [[updating-the-all-thing]] first.*";
const clean = (value) => String(value ?? "").replace(/[\r\n|]+/g, " ").trim();
const slug = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
const today = () => new Date().toISOString().slice(0, 10);
const bump = (page) => page.replace(/^(updated: )\d{4}-\d{2}-\d{2}/m, `$1${today()}`);
const read = (path) => readFileSync(join(root, path), "utf8");
const write = (path, value) => writeFileSync(join(root, path), value);
function lintIssues() {
  const result = spawnSync("python3", ["_meta/lint.py"], { cwd: root, encoding: "utf8" });
  const count = Number(result.stdout.match(/(\d+) issue\(s\)\./)?.[1]);
  if (!Number.isFinite(count)) throw new Error(`All Thing lint did not return an issue count: ${result.stderr.slice(0, 200)}`);
  return count;
}

function findPage(lead) {
  for (const dir of readdirSync(join(root, "leads"), { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const path = `leads/${dir.name}/${dir.name}.md`;
    if (existsSync(join(root, path)) && read(path).includes(`swapp_deal_id: ${lead.id}`)) return dir.name;
  }
  const base = slug(lead.company || lead.name) || "unnamed-lead";
  return existsSync(join(root, "leads", base)) ? `${base}-${lead.id.slice(0, 8)}` : base;
}

function updateHub(page, name, lead) {
  const stage = clean(lead.pipelineItems[0]?.stage?.key || "lead");
  const line = `| [[${name}]] | ${stage} | ${lead.pipeId ? `#${clean(lead.pipeId)}` : "—"} | ${today()} | ${clean(lead.nextAction || "Confirm next action")} |`;
  const rows = page.split("\n");
  const old = rows.findIndex((row) => row.startsWith(`| [[${name}]] |`));
  if (old >= 0) rows[old] = line;
  else {
    const at = rows.findIndex((row) => /^\|---\|/.test(row));
    if (at < 0) throw new Error("Leads hub table missing");
    rows.splice(at + 1, 0, line);
  }
  return bump(rows.join("\n"));
}

function newLeadPage(name, lead) {
  const label = clean(lead.company || lead.name), stage = clean(lead.pipelineItems[0]?.stage?.key || "lead");
  const next = clean(lead.nextAction || "Confirm identity, need, and next action");
  return `---
title: ${JSON.stringify(label + " (lead)")}
created: ${today()}
updated: ${today()}
type: entity
tags: [prospect, conroe]
sources: []
confidence: low
lead_stage: ${stage}
deal_id: ${lead.pipeId || "null"}
swapp_deal_id: ${lead.id}
up: leads
---

# ${label} (lead)

${label} is an active contact in [[leads]]. The need and offer are not confirmed. History: [[${name}-diary]]. Shape: [[sop-lead-file]].

## At a glance

| | |
|---|---|
| **Contact** | ${clean(lead.name)} |
| **Stage** | ${stage} |
| **Next** | ${next} |

## Who they are

Full identity and company are not confirmed.

## What they need

Not confirmed.

## What we offered

No offer verified.

## What we know and do not know

A call occurred; its content has not been verified.

## Next action

${next}

## Where things live

Quo holds the call record. SWapp holds stage and next action.

## See also

[[leads]] · [[sop-lead-file]]

${footer}
`;
}

async function processJob(job) {
  const event = job.event;
  if (!event.leadId) throw new Error("Event has no reviewed lead identity");
  const lead = await prisma.meetingLead.findUnique({ where: { id: event.leadId }, select: { id: true, brandId: true, name: true, company: true, pipeId: true, nextAction: true, pipelineItems: { where: { isActive: true }, select: { stage: { select: { key: true } } }, take: 1 } } });
  const brand = await prisma.brand.findUnique({ where: { id: event.brandId }, select: { slug: true } });
  if (!lead || !brand || lead.brandId !== event.brandId || brand.slug !== "bookkeeping-conroe") throw new Error("Only a linked Bookkeeping Conroe lead is supported");
  const name = findPage(lead), label = clean(lead.company || lead.name);
  const leadPath = `leads/${name}/${name}.md`, diaryPath = `leads/${name}/${name}-diary.md`;
  const paths = [leadPath, diaryPath, "hubs/leads.md", "index.md", "log.md"];
  const dirty = git("status", "--porcelain", "--", ...paths);
  if (dirty) throw new Error(`All Thing paths already have edits: ${dirty}`);
  const baselineLintIssues = lintIssues();
  const originals = new Map(paths.map((path) => [path, existsSync(join(root, path)) ? read(path) : null]));
  const marker = `<!-- swapp-event:${event.id} -->`;
  try {
  const existing = existsSync(join(root, leadPath));
  if (existing && !read(leadPath).includes(`swapp_deal_id: ${lead.id}`)) throw new Error("Existing lead page has another SWapp ID");
  mkdirSync(join(root, "leads", name), { recursive: true });
  if (!existing) write(leadPath, newLeadPage(name, lead));
  const diary = existsSync(join(root, diaryPath)) ? read(diaryPath) : `---
title: ${JSON.stringify(label + " (lead) - diary")}
created: ${today()}
updated: ${today()}
type: entity
tags: [prospect, conroe]
sources: []
confidence: low
up: ${name}
---

# ${label} (lead) - diary

History, newest first. Lead page: [[${name}]]. Shape: [[sop-lead-file]].

${footer}
`;
  if (!diary.includes(marker)) {
    const frontmatterEnd = diary.indexOf("\n---\n", 4);
    const firstEntry = diary.indexOf("\n## ", frontmatterEnd + 5);
    const at = firstEntry >= 0 ? firstEntry : diary.lastIndexOf("\n---\n*Changing this page?");
    if (at < 0) throw new Error("Lead diary entry point missing");
    const entry = `## ${event.occurredAt.toISOString().slice(0, 10)}: ${clean(event.eventType).replace(/_/g, " ")}

- ${clean(event.summary)}
- Source: ${clean(event.sourceRef || `${event.source}:${event.sourceEventId}`)}.${event.source === "quo" ? " The call record confirms contact, not the conversation." : ""}
${marker}

`;
    write(diaryPath, bump(diary.slice(0, at) + "\n" + entry + diary.slice(at)));
  }
  write("hubs/leads.md", updateHub(read("hubs/leads.md"), name, lead));
  if (!existing) {
    const index = read("index.md");
    const section = index.match(/(## Leads\n)([\s\S]*?)(\n## [^\n]+\n)/);
    if (!section) throw new Error("Index Leads section missing");
    const lines = [...section[2].split("\n").filter((line) => line.startsWith("- [[")),
      `- [[${name}]] — ${label} lead file.`, `- [[${name}-diary]] — ${label} lead history.`]
      .sort((a, b) => a.localeCompare(b));
    write("index.md", bump(index.replace(section[0], section[1] + "\n" + lines.join("\n") + "\n" + section[3])));
  }
  const log = read("log.md");
  if (!log.includes(`SWapp sales event ${event.id}`)) write("log.md", log + `\n## [${today()}] update | SWapp sales event ${event.id}\n- ${clean(event.eventType)} for ${label}; [[${name}-diary]].\n`);
  const finalLintIssues = lintIssues();
  if (finalLintIssues > baselineLintIssues) throw new Error(`All Thing lint grew from ${baselineLintIssues} to ${finalLintIssues} issues`);
  if (finalLintIssues > 0) console.warn(`All Thing lint still has ${finalLintIssues} existing issues`);
  } catch (error) {
    for (const [path, original] of originals) {
      if (original === null) {
        if (existsSync(join(root, path))) execFileSync("rm", ["--", join(root, path)]);
      } else write(path, original);
    }
    throw error;
  }
  if (git("status", "--porcelain", "--", ...paths)) {
    git("add", "--", ...paths);
    git("commit", "-m", `Record SWapp sales event ${event.id}`, "--", ...paths);
  }
  git("push", "origin", "main");
  if (!read(diaryPath).includes(marker)) throw new Error("Diary read-back lacks marker");
  await prisma.allThingWriteJob.update({ where: { id: job.id }, data: { status: "done", completedAt: new Date(), lastError: null } });
}

try {
  const jobs = await prisma.allThingWriteJob.findMany({ where: { status: { in: ["pending", "failed"] } }, include: { event: true }, orderBy: { createdAt: "asc" }, take: 20 });
  for (const job of jobs) {
    try { await processJob(job); console.log(`Completed All Thing job ${job.id}`); }
    catch (error) {
      const message = String(error instanceof Error ? error.message : error).slice(0, 1000);
      await prisma.allThingWriteJob.update({ where: { id: job.id }, data: { status: "failed", attempts: { increment: 1 }, lastError: message } });
      console.error(`Failed All Thing job ${job.id}: ${message}`);
      break;
    }
  }
} finally { await prisma.$disconnect(); }
