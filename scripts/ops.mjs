#!/usr/bin/env node
// ops: post Operations evidence and read the board (SWapp /api/operations).
// Config: ~/.config/swapp/operations.env with SWAPP_OPERATIONS_TOKEN and
// SWAPP_BASE_URL. See docs/operations-api.md.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";

const USAGE = `ops board                      open work (problems first)
ops duties                     duty ids and who does them
ops done|waiting|needs-tom|failed DUTY --summary "..." [--client KEY] [--period YYYY-MM-DD]
                               [--ref LINK-OR-ID] [--by NAME] [--details JSON] [--event-id ID]
                               [--qb SLUG]  (onboarding-quickbooks: links the client's qb company)
ops client KEY --name "..." --starts YYYY-MM-DD [--double ID] [--qb SLUG] [--stage onboarding|active|former] [--inactive]
ops client-won ENGAGEMENT-ID   re-run the new-client steps (backfill or retry)
ops services                   service records and today's MRR under the rule
ops service-load FILE.json     upsert service records (JSON array, one object per record;
                               fields in docs/operations-api.md); safe to run again
ops service-sync [--dry-run]   set service and client tags from the records (also nightly)
Options: --brand SLUG (default bookkeeping-conroe)`;

const STATUS = { done: "done", waiting: "waiting_client", "needs-tom": "needs_tom", failed: "failed" };

function config() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync(`${homedir()}/.config/swapp/operations.env`, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/);
      if (m && !env[m[1]]) env[m[1]] = m[2];
    }
  } catch {
    // Environment variables alone are fine.
  }
  if (!env.SWAPP_OPERATIONS_TOKEN) throw new Error("SWAPP_OPERATIONS_TOKEN is not set (~/.config/swapp/operations.env)");
  return { token: env.SWAPP_OPERATIONS_TOKEN, base: (env.SWAPP_BASE_URL || "https://admin.southwestdigital.io").replace(/\/$/, "") };
}

function parse(argv) {
  const args = [];
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--inactive") opts.inactive = true;
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a.startsWith("--")) opts[a.slice(2)] = argv[(i += 1)];
    else args.push(a);
  }
  return { args, opts };
}

async function call(method, path, body) {
  const { token, base } = config();
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status}: ${json.error ?? res.statusText}`);
  return json;
}

async function main() {
  const { args, opts } = parse(process.argv.slice(2));
  const [cmd, target] = args;
  const brand = opts.brand || "bookkeeping-conroe";

  if (cmd === "board") {
    const { items } = await call("GET", `/api/operations/board?brand=${encodeURIComponent(brand)}`);
    const open = items.filter((i) => i.state !== "done");
    for (const i of open) {
      console.log(`${i.label.padEnd(17)} ${i.period}  ${i.duty.padEnd(26)} ${i.client ?? "(firm)"}`);
    }
    console.log(`${open.length} open, ${items.length - open.length} done`);
    return;
  }
  if (cmd === "duties") {
    const { items } = await call("GET", `/api/operations/board?brand=${encodeURIComponent(brand)}`);
    const seen = new Map(items.map((i) => [i.duty, i.title]));
    for (const [id, title] of seen) console.log(`${id.padEnd(28)} ${title}`);
    return;
  }
  if (STATUS[cmd]) {
    if (!target || !opts.summary) throw new Error(`usage:\n${USAGE}`);
    const body = {
      brand,
      duty: target,
      client: opts.client,
      period: opts.period,
      status: STATUS[cmd],
      summary: opts.summary,
      sourceRef: opts.ref,
      reportedBy: opts.by || process.env.USER || "agent",
      details: opts.details ? JSON.parse(opts.details) : undefined,
      qbCompany: opts.qb,
    };
    // Same report sent twice (a retry) is recorded once.
    body.sourceEventId =
      opts["event-id"] ||
      createHash("sha256").update(JSON.stringify([body.duty, body.client, body.period, body.status, body.summary])).digest("hex").slice(0, 32);
    const out = await call("POST", "/api/operations/evidence", body);
    console.log(out.duplicate ? `already recorded (${out.id ?? "same event id"})` : `recorded ${out.id} for ${out.period}`);
    if (out.stage) console.log(`client moved to ${out.stage}`);
    return;
  }
  if (cmd === "client") {
    if (!target || !opts.name || !opts.starts) throw new Error(`usage:\n${USAGE}`);
    const out = await call("PUT", "/api/operations/clients", {
      brand,
      key: target,
      name: opts.name,
      startsOn: opts.starts,
      doubleClientId: opts.double ? Number(opts.double) : undefined,
      qbCompany: opts.qb,
      stage: opts.stage,
      active: !opts.inactive,
    });
    console.log(`${out.key}: ${out.active ? out.stage : "inactive"}`);
    return;
  }
  if (cmd === "client-won") {
    if (!target) throw new Error(`usage:\n${USAGE}`);
    const out = await call("POST", "/api/operations/client-won", { brand, engagementId: target });
    for (const line of out.done) console.log(`done    ${line}`);
    for (const line of out.failed) console.log(`FAILED  ${line}`);
    if (out.failed.length) process.exitCode = 1;
    return;
  }
  if (cmd === "services") {
    const { today, mrr, mismatches, records } = await call("GET", `/api/operations/service-records?brand=${encodeURIComponent(brand)}`);
    for (const r of records) {
      const fee = r.feeAmount === null ? "-" : `$${r.feeAmount}`;
      const end = r.endDate ? `${r.endDate} ${r.endReason}` : r.startDate > today ? "starting" : "active";
      console.log(`${r.contactName.slice(0, 28).padEnd(28)} ${r.product.padEnd(24)} ${r.basis.padEnd(8)} ${fee.padStart(8)}  ${r.startDate}  ${end}`);
    }
    console.log(`MRR ${today}: $${mrr.total}/mo, ${mrr.clients} client${mrr.clients === 1 ? "" : "s"} (${records.length} records)`);
    for (const m of mismatches ?? []) console.log(`MISMATCH ${m.name}: ${m.problem}`);
    return;
  }
  if (cmd === "service-load") {
    if (!target) throw new Error(`usage:\n${USAGE}`);
    const records = JSON.parse(readFileSync(target, "utf8"));
    if (!Array.isArray(records)) throw new Error("the file must hold a JSON array");
    let failed = 0;
    // In file order, so a record that replaces another comes after it.
    for (const record of records) {
      try {
        const out = await call("PUT", "/api/operations/service-records", { brand, ...record });
        console.log(`${out.created ? "created" : "updated"}  ${out.sourceKey}`);
        if (out.tags) console.log(`         tags +${out.tags.add.join(" +") || "-"}  -${out.tags.remove.join(" -") || "-"}`);
      } catch (error) {
        failed += 1;
        console.log(`FAILED   ${record.sourceKey ?? "(no sourceKey)"}: ${error.message}`);
      }
    }
    console.log(`${records.length - failed} loaded, ${failed} failed`);
    if (failed) process.exitCode = 1;
    return;
  }
  if (cmd === "service-sync") {
    const dryRun = Boolean(opts.dryRun);
    const { changes } = await call("POST", "/api/operations/service-records/sync", { brand, dryRun });
    for (const c of changes) {
      console.log(`${c.name.slice(0, 28).padEnd(28)} +${c.add.join(" +") || "-"}  -${c.remove.join(" -") || "-"}`);
    }
    console.log(`${changes.length} contact${changes.length === 1 ? "" : "s"} ${dryRun ? "would change (dry run)" : "changed"}`);
    return;
  }
  console.log(USAGE);
  process.exitCode = cmd ? 2 : 0;
}

main().catch((error) => {
  console.error(`ops: ${error.message}`);
  process.exit(1);
});
