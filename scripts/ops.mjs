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
ops client KEY --name "..." --starts YYYY-MM-DD [--double ID] [--qb SLUG] [--inactive]
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
    };
    // Same report sent twice (a retry) is recorded once.
    body.sourceEventId =
      opts["event-id"] ||
      createHash("sha256").update(JSON.stringify([body.duty, body.client, body.period, body.status, body.summary])).digest("hex").slice(0, 32);
    const out = await call("POST", "/api/operations/evidence", body);
    console.log(out.duplicate ? `already recorded (${out.id ?? "same event id"})` : `recorded ${out.id} for ${out.period}`);
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
      active: !opts.inactive,
    });
    console.log(`${out.key}: ${out.active ? "active" : "inactive"}`);
    return;
  }
  console.log(USAGE);
  process.exitCode = cmd ? 2 : 0;
}

main().catch((error) => {
  console.error(`ops: ${error.message}`);
  process.exit(1);
});
