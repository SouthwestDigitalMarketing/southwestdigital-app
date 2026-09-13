#!/usr/bin/env node

import { createServer } from "node:http";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { hostname } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const REGIONS = {
  US: { accountsHost: "accounts.zoho.com", mailApiHost: "mail.zoho.com" },
  EU: { accountsHost: "accounts.zoho.eu", mailApiHost: "mail.zoho.eu" },
  IN: { accountsHost: "accounts.zoho.in", mailApiHost: "mail.zoho.in" },
  AU: { accountsHost: "accounts.zoho.com.au", mailApiHost: "mail.zoho.com.au" },
};

// The CLI deliberately requests no UPDATE or DELETE scopes. CREATE is still
// required by Zoho for saving drafts, so the command surface below is the
// second safety boundary: there is no send command and draft payloads are
// always built with mode: "draft".
export const ZOHO_AGENT_SCOPES = [
  "ZohoMail.accounts.READ",
  "ZohoMail.messages.READ",
  "ZohoMail.messages.CREATE",
  "ZohoMail.folders.READ",
];

const DEFAULT_REGION = "US";
const DEFAULT_PORT = 8765;
const DEFAULT_REDIRECT_URI = `http://127.0.0.1:${DEFAULT_PORT}/callback`;
const SECRET_SERVICE = "swapp-zoho-mail-agent";
const SECRET_ACCOUNT = "default";
const PASS_PATH = "swapp/zoho-mail-agent/refresh-token";

export class ZohoMailAgentError extends Error {}

export class ZohoApiError extends ZohoMailAgentError {
  constructor(message, status, body) {
    super(message);
    this.name = "ZohoApiError";
    this.status = status;
    this.body = body;
  }
}

function loadLocalEnv() {
  const envPath = process.env.SWAPP_ZOHO_ENV_FILE || join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  const source = readFileSync(envPath, "utf8");
  for (const line of source.split(/\r?\n/u)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/u);
    if (!match || process.env[match[1]]) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

function regionConfig(region) {
  const key = String(region || DEFAULT_REGION).toUpperCase();
  if (!REGIONS[key]) throw new ZohoMailAgentError(`Unsupported Zoho region: ${region}`);
  return { key, ...REGIONS[key] };
}

function credentials() {
  const clientId = process.env.ZOHO_MAIL_AGENT_CLIENT_ID?.trim();
  const clientSecret = process.env.ZOHO_MAIL_AGENT_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new ZohoMailAgentError(
      "Set ZOHO_MAIL_AGENT_CLIENT_ID and ZOHO_MAIL_AGENT_CLIENT_SECRET in .env.local first.",
    );
  }
  return { clientId, clientSecret };
}

function redirectUri() {
  return process.env.ZOHO_MAIL_AGENT_REDIRECT_URI?.trim() || DEFAULT_REDIRECT_URI;
}

function commandExists(command) {
  return spawnSync("/bin/sh", ["-c", "command -v \"$1\" >/dev/null 2>&1", "sh", command], {
    stdio: "ignore",
  }).status === 0;
}

function readSecretTool() {
  if (!commandExists("secret-tool")) return null;
  try {
    const value = execFileSync(
      "secret-tool",
      ["lookup", "service", SECRET_SERVICE, "account", SECRET_ACCOUNT],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    return value || null;
  } catch {
    return null;
  }
}

function readPass() {
  if (!commandExists("pass")) return null;
  try {
    const value = execFileSync("pass", ["show", PASS_PATH], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return value || null;
  } catch {
    return null;
  }
}

function writeSecretTool(value) {
  if (!commandExists("secret-tool")) return false;
  const result = spawnSync(
    "secret-tool",
    ["store", "--label=SWapp Zoho Mail Agent", "service", SECRET_SERVICE, "account", SECRET_ACCOUNT],
    { input: value, encoding: "utf8", stdio: ["pipe", "ignore", "ignore"] },
  );
  return result.status === 0;
}

function writePass(value) {
  if (!commandExists("pass")) return false;
  const result = spawnSync("pass", ["insert", "--force", "--multiline", PASS_PATH], {
    input: value,
    encoding: "utf8",
    stdio: ["pipe", "ignore", "ignore"],
  });
  return result.status === 0;
}

export function readStoredMailbox() {
  const raw = readSecretTool() || readPass();
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw);
    if (
      !stored ||
      typeof stored.refreshToken !== "string" ||
      typeof stored.region !== "string" ||
      typeof stored.accountIdentifier !== "string" ||
      typeof stored.emailAddress !== "string"
    ) {
      throw new Error("invalid stored mailbox");
    }
    return stored;
  } catch {
    throw new ZohoMailAgentError("The stored Zoho mailbox credential is invalid. Run the auth command again.");
  }
}

export function storeMailbox(mailbox) {
  const value = JSON.stringify(mailbox);
  if (writeSecretTool(value) || writePass(value)) return;
  throw new ZohoMailAgentError(
    "Could not store the Zoho refresh token. Ensure secret-tool or pass is initialized, then retry auth.",
  );
}

function authHeader(accessToken) {
  return `Zoho-oauthtoken ${accessToken}`;
}

async function parseResponse(response) {
  const text = await response.text();
  try {
    return { text, json: JSON.parse(text) };
  } catch {
    return { text, json: null };
  }
}

async function tokenRequest(region, params) {
  const response = await fetch(`https://${region.accountsHost}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const { text, json } = await parseResponse(response);
  if (!response.ok || !json?.access_token) {
    throw new ZohoApiError("Zoho token request failed", response.status, text.slice(0, 1000));
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token || null,
    expiresInSeconds: typeof json.expires_in === "number" ? json.expires_in : 3600,
    scope: json.scope || null,
  };
}

export async function exchangeAuthorizationCode({ region, code }) {
  const { clientId, clientSecret } = credentials();
  return tokenRequest(regionConfig(region), new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri(),
    code,
  }));
}

export async function refreshMailbox(mailbox) {
  const { clientId, clientSecret } = credentials();
  const token = await tokenRequest(regionConfig(mailbox.region), new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: mailbox.refreshToken,
  }));
  if (token.refreshToken && token.refreshToken !== mailbox.refreshToken) {
    storeMailbox({ ...mailbox, refreshToken: token.refreshToken });
  }
  return token.accessToken;
}

async function apiRequest(mailbox, accessToken, pathname, options = {}) {
  const region = regionConfig(mailbox.region);
  const response = await fetch(`https://${region.mailApiHost}/api/${pathname}`, {
    ...options,
    headers: {
      Authorization: authHeader(accessToken),
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const { text, json } = await parseResponse(response);
  if (!response.ok) throw new ZohoApiError("Zoho Mail API request failed", response.status, text.slice(0, 1200));
  return { text, json };
}

async function fetchPrimaryAccount(region, accessToken) {
  const mailbox = { region, accountIdentifier: "unused", emailAddress: "unused", refreshToken: "unused" };
  const { json } = await apiRequest(mailbox, accessToken, "accounts");
  const first = json?.data?.[0];
  if (!first || (first.accountId === undefined && first.accountId !== 0)) {
    throw new ZohoMailAgentError("Zoho returned no mailbox accounts.");
  }
  return {
    accountIdentifier: String(first.accountId),
    emailAddress: String(first.primaryEmailAddress || first.mailboxAddress || ""),
    displayName:
      first.accountDisplayName || [first.firstName, first.lastName].filter(Boolean).join(" ").trim() || null,
  };
}

async function authorize() {
  const requestedRegion = process.env.ZOHO_MAIL_AGENT_REGION?.trim() || DEFAULT_REGION;
  const region = regionConfig(requestedRegion);
  const { clientId } = credentials();
  const callback = new URL(redirectUri());
  if (!(["127.0.0.1", "localhost"].includes(callback.hostname)) || callback.protocol !== "http:") {
    throw new ZohoMailAgentError("ZOHO_MAIL_AGENT_REDIRECT_URI must be an http localhost/127.0.0.1 callback.");
  }
  const state = randomBytes(32).toString("hex");
  const authorization = new URL(`https://${region.accountsHost}/oauth/v2/auth`);
  authorization.search = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: ZOHO_AGENT_SCOPES.join(","),
    redirect_uri: callback.toString(),
    access_type: "offline",
    prompt: "consent",
    state,
  }).toString();

  const port = Number(callback.port || DEFAULT_PORT);
  const code = await new Promise((resolveCode, reject) => {
    const server = createServer((request, response) => {
      const url = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);
      if (url.pathname !== callback.pathname) {
        response.writeHead(404).end("Not found");
        return;
      }
      if (url.searchParams.get("state") !== state) {
        response.writeHead(400).end("Invalid OAuth state");
        server.close();
        reject(new ZohoMailAgentError("Zoho OAuth state did not match."));
        return;
      }
      const error = url.searchParams.get("error");
      const receivedCode = url.searchParams.get("code");
      response.writeHead(error || !receivedCode ? 400 : 200, { "Content-Type": "text/plain" });
      response.end(error ? `Zoho authorization failed: ${error}` : "Zoho authorization complete. Return to the terminal.");
      server.close();
      if (error) reject(new ZohoMailAgentError(`Zoho authorization failed: ${error}`));
      else resolveCode(receivedCode);
    });
    server.once("error", (error) => reject(new ZohoMailAgentError(`OAuth callback could not start: ${error.message}`)));
    server.listen(port, callback.hostname, () => {
      console.log(`Open this URL in Chrome, then return here:\n\n${authorization}\n`);
      if (process.env.ZOHO_MAIL_AGENT_NO_OPEN !== "1" && commandExists("xdg-open")) {
        const child = spawn("xdg-open", [authorization.toString()], { stdio: "ignore", detached: true });
        child.unref();
      }
    });
  });

  const token = await exchangeAuthorizationCode({ region: region.key, code });
  if (!token.refreshToken) throw new ZohoMailAgentError("Zoho did not return a refresh token.");
  const account = await fetchPrimaryAccount(region.key, token.accessToken);
  const mailbox = {
    region: region.key,
    accountIdentifier: account.accountIdentifier,
    emailAddress: account.emailAddress,
    displayName: account.displayName,
    refreshToken: token.refreshToken,
    scopes: token.scope || ZOHO_AGENT_SCOPES.join(" "),
    host: hostname(),
  };
  storeMailbox(mailbox);
  console.log(`Authorized ${mailbox.emailAddress} (${mailbox.region}). Token stored in the local keyring.`);
  console.log("This CLI can read mail and create drafts; it has no send command.");
}

async function authenticatedMailbox() {
  const mailbox = readStoredMailbox();
  if (!mailbox) throw new ZohoMailAgentError("No terminal mailbox is authorized. Run: npm run mail:agent -- auth");
  const accessToken = await refreshMailbox(mailbox);
  return { mailbox, accessToken };
}

async function fetchFolders(mailbox, accessToken) {
  const { json } = await apiRequest(mailbox, accessToken, `accounts/${encodeURIComponent(mailbox.accountIdentifier)}/folders`);
  return Array.isArray(json?.data) ? json.data : [];
}

function inboxFolderId(folders) {
  const inbox = folders.find((folder) => String(folder.folderType || "").toLowerCase() === "inbox")
    || folders.find((folder) => String(folder.folderName || "").toLowerCase() === "inbox");
  return inbox?.folderId ? String(inbox.folderId) : null;
}

function messageDate(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return new Date(numeric).toISOString();
}

export function normalizeMessage(message) {
  return {
    messageId: String(message.messageId || ""),
    threadId: message.threadId ? String(message.threadId) : null,
    folderId: message.folderId ? String(message.folderId) : null,
    from: message.fromAddress || message.sender || null,
    to: message.toAddress || null,
    subject: message.subject || "(no subject)",
    receivedAt: message.receivedTime ? messageDate(message.receivedTime) : null,
    unread: String(message.status || "") === "0",
    flag: message.flagid || null,
    hasAttachment: String(message.hasAttachment || "0") === "1",
    summary: message.summary || null,
  };
}

async function recent(args) {
  const { mailbox, accessToken } = await authenticatedMailbox();
  const limit = Math.min(200, Math.max(1, Number(args.limit || 20)));
  let folderId = null;
  try {
    folderId = inboxFolderId(await fetchFolders(mailbox, accessToken));
  } catch (error) {
    console.error(`Folder lookup skipped: ${error instanceof Error ? error.message : String(error)}`);
  }
  const query = new URLSearchParams({
    start: "1",
    limit: String(limit),
    sortBy: "date",
    sortorder: "false",
    status: args.unread ? "unread" : "all",
    includeto: "true",
  });
  if (folderId) query.set("folderId", folderId);
  const { json } = await apiRequest(
    mailbox,
    accessToken,
    `accounts/${encodeURIComponent(mailbox.accountIdentifier)}/messages/view?${query.toString()}`,
  );
  const messages = Array.isArray(json?.data) ? json.data.map(normalizeMessage) : [];
  const result = { mailbox: mailbox.emailAddress, region: mailbox.region, count: messages.length, messages };
  if (args.json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`${mailbox.emailAddress}: ${messages.length} recent message(s)`);
    for (const message of messages) {
      console.log(`${message.unread ? "UNREAD" : "read  "} ${message.receivedAt || "unknown date"} ${message.from || "unknown sender"} — ${message.subject} [${message.messageId}]`);
    }
  }
}

function headerMap(rawHeaders) {
  const headers = {};
  let current = null;
  for (const line of rawHeaders.split(/\r?\n/u)) {
    if (/^\s/u.test(line) && current) {
      headers[current] += ` ${line.trim()}`;
      continue;
    }
    const separator = line.indexOf(":");
    if (separator < 1) continue;
    current = line.slice(0, separator).toLowerCase();
    headers[current] = line.slice(separator + 1).trim();
  }
  return headers;
}

export function parseOriginalMessage(raw) {
  let source = raw;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.data === "string") source = parsed.data;
    else if (typeof parsed?.data?.content === "string") source = parsed.data.content;
  } catch {
    // Zoho commonly returns the original MIME as plain text.
  }
  const split = source.match(/\r?\n\r?\n/u);
  const index = split?.index ?? -1;
  const rawHeaders = index >= 0 ? source.slice(0, index) : source;
  const body = index >= 0 ? source.slice(index + split[0].length) : "";
  return { headers: headerMap(rawHeaders), body, source };
}

function emailAddress(value) {
  const angle = String(value || "").match(/<([^>]+)>/u);
  return (angle?.[1] || String(value || "")).trim();
}

function replySubject(subject) {
  const value = String(subject || "(no subject)").trim();
  return /^re:/iu.test(value) ? value : `Re: ${value}`;
}

async function originalMessage(mailbox, accessToken, messageId) {
  return apiRequest(
    mailbox,
    accessToken,
    `accounts/${encodeURIComponent(mailbox.accountIdentifier)}/messages/${encodeURIComponent(messageId)}/originalmessage`,
  );
}

async function show(args) {
  const messageId = args.positionals[0];
  if (!messageId) throw new ZohoMailAgentError("Usage: show <message-id>");
  const { mailbox, accessToken } = await authenticatedMailbox();
  const { text } = await originalMessage(mailbox, accessToken, messageId);
  const message = parseOriginalMessage(text);
  const result = {
    mailbox: mailbox.emailAddress,
    messageId,
    from: message.headers.from || null,
    to: message.headers.to || null,
    replyTo: message.headers["reply-to"] || null,
    subject: message.headers.subject || null,
    date: message.headers.date || null,
    messageIdHeader: message.headers["message-id"] || null,
    references: message.headers.references || null,
    body: message.body,
  };
  if (args.json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`From: ${result.from || "unknown"}`);
    console.log(`Subject: ${result.subject || "(no subject)"}`);
    console.log(`Date: ${result.date || "unknown"}`);
    console.log(`Message ID: ${result.messageIdHeader || messageId}`);
    console.log(`\n${result.body}`);
  }
}

function option(args, name) {
  const index = args.indexOf(name);
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new ZohoMailAgentError(`${name} needs a value.`);
  return value;
}

function bodyFromArgs(args) {
  const file = option(args, "--body-file");
  if (file) return file === "-" ? readFileSync(0, "utf8") : readFileSync(resolve(file), "utf8");
  const body = option(args, "--body");
  if (body !== null) return body;
  throw new ZohoMailAgentError("Draft replies require --body-file <path> or --body <text>.");
}

export function buildDraftPayload({ mailbox, original, body }) {
  const messageIdHeader = original.headers["message-id"];
  if (!messageIdHeader) throw new ZohoMailAgentError("The original message has no Message-ID header; cannot thread a reply.");
  const recipient = emailAddress(original.headers["reply-to"] || original.headers.from);
  if (!recipient || !recipient.includes("@")) throw new ZohoMailAgentError("The original message has no usable reply address.");
  const references = [original.headers.references, messageIdHeader].filter(Boolean).join(" ");
  return {
    mode: "draft",
    fromAddress: mailbox.emailAddress,
    toAddress: recipient,
    subject: replySubject(original.headers.subject),
    content: body,
    mailFormat: "plaintext",
    askReceipt: "no",
    inReplyTo: messageIdHeader,
    ...(references ? { refHeader: references } : {}),
  };
}

async function draftReply(args) {
  const messageId = args.positionals[0];
  if (!messageId) throw new ZohoMailAgentError("Usage: draft-reply <message-id> --body-file <path>");
  const body = bodyFromArgs(args);
  if (!body.trim()) throw new ZohoMailAgentError("Draft body cannot be empty.");
  const { mailbox, accessToken } = await authenticatedMailbox();
  const { text } = await originalMessage(mailbox, accessToken, messageId);
  const original = parseOriginalMessage(text);
  const payload = buildDraftPayload({ mailbox, original, body });
  const { json } = await apiRequest(
    mailbox,
    accessToken,
    `accounts/${encodeURIComponent(mailbox.accountIdentifier)}/messages`,
    { method: "POST", body: JSON.stringify(payload) },
  );
  console.log(JSON.stringify({
    draftCreated: true,
    mailbox: mailbox.emailAddress,
    inReplyTo: payload.inReplyTo,
    subject: payload.subject,
    zoho: json?.data || null,
  }, null, 2));
}

function usage() {
  console.log(`SWapp Zoho Mail Agent (read + draft only)

Commands:
  auth
  recent [--limit N] [--unread] [--json]
  show <message-id> [--json]
  draft-reply <message-id> (--body-file PATH | --body TEXT)

The CLI has no send, delete, archive, mark-read, move, or label command.`);
}

function parseCommandArgs(args) {
  const command = args[0];
  return {
    command,
    positionals: args.slice(1).filter((value, index, all) => {
      if (value.startsWith("--")) return false;
      const previous = all[index - 1];
      return previous !== "--limit" && previous !== "--body-file" && previous !== "--body";
    }),
    limit: option(args, "--limit"),
    unread: args.includes("--unread"),
    json: args.includes("--json"),
  };
}

export async function main(argv = process.argv.slice(2)) {
  loadLocalEnv();
  const parsed = parseCommandArgs(argv);
  if (!parsed.command || parsed.command === "help" || parsed.command === "--help") {
    usage();
    return;
  }
  if (parsed.command === "auth") return authorize();
  if (parsed.command === "recent" || parsed.command === "triage") return recent(parsed);
  if (parsed.command === "show") return show(parsed);
  if (parsed.command === "draft-reply") return draftReply(parsed);
  throw new ZohoMailAgentError(`Unknown command: ${parsed.command}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
