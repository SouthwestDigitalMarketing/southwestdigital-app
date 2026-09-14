#!/usr/bin/env node

/**
 * Small, dependency-free YouTube uploader for the Ripley video workstation.
 *
 * The service deliberately uploads only files with a *.youtube.json sidecar.
 * That keeps test renders out of YouTube until an agent has explicitly marked
 * a render ready. Uploads default to Private.
 */

import { createServer } from "node:http";
import { promises as fs, createReadStream } from "node:fs";
import path from "node:path";
import process from "node:process";
import { URL } from "node:url";

const ROOT = process.env.SD_VIDEO_UPLOAD_ROOT ?? "/mnt/nostromo/01 Real Estate Bookkeeper/videos";
const CONFIG_DIR = process.env.SD_VIDEO_UPLOAD_CONFIG ?? "/home/tom/.config/sd-video-youtube";
const ENV_FILE = process.env.SD_VIDEO_ENV_FILE ?? "/home/tom/Projects/southwestdigital-app/.env.local";
const STATE_FILE = path.join(CONFIG_DIR, "state.json");
const TOKEN_FILE = path.join(CONFIG_DIR, "token.json");
const CALLBACK_PORT = Number(process.env.SD_VIDEO_OAUTH_PORT ?? 4567);
const POLL_SECONDS = Number(process.env.SD_VIDEO_UPLOAD_INTERVAL_SECONDS ?? 60);
const CHUNK_SIZE = 8 * 1024 * 1024;
const UPLOAD_SCOPE = "https://www.googleapis.com/auth/youtube.upload";
const READ_SCOPE = "https://www.googleapis.com/auth/youtube.readonly";
const PUBLISH_SCOPE = "https://www.googleapis.com/auth/youtube.force-ssl";
const SCOPES = [UPLOAD_SCOPE, READ_SCOPE, PUBLISH_SCOPE];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function log(...parts) {
  console.log(new Date().toISOString(), ...parts);
}

function parseEnv(text) {
  const values = {};
  for (const raw of text.split(/\r?\n/)) {
    const match = raw.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2];
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

async function readClientCredentials() {
  const env = parseEnv(await fs.readFile(ENV_FILE, "utf8"));
  const clientId = env.YOUTUBE_OAUTH_CLIENT_ID;
  const clientSecret = env.YOUTUBE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(`Missing YOUTUBE_OAUTH_CLIENT_ID or YOUTUBE_OAUTH_CLIENT_SECRET in ${ENV_FILE}`);
  }
  return { clientId, clientSecret };
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.tmp-${process.pid}`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await fs.rename(temporary, file);
  await fs.chmod(file, 0o600);
}

async function getToken() {
  const token = await readJson(TOKEN_FILE, null);
  if (!token?.refresh_token) {
    throw new Error(`No YouTube authorization yet. Run: ${process.argv[1]} authorize`);
  }
  return token;
}

async function accessToken() {
  const { clientId, clientSecret } = await readClientCredentials();
  const token = await getToken();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: token.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(`Google token refresh failed (${response.status}): ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

async function youtubeFetch(url, options = {}) {
  const token = await accessToken();
  const response = await fetch(url, {
    ...options,
    headers: { authorization: `Bearer ${token}`, ...(options.headers ?? {}) },
  });
  return response;
}

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (entry.isFile() && entry.name.endsWith(".youtube.json")) files.push(full);
  }
  return files;
}

function safePath(candidate, root) {
  const resolved = path.resolve(candidate);
  const base = path.resolve(root) + path.sep;
  if (!resolved.startsWith(base)) throw new Error(`File is outside the video root: ${resolved}`);
  return resolved;
}

async function manifests() {
  const files = await walk(ROOT);
  const result = [];
  for (const manifestPath of files) {
    try {
      const manifest = await readJson(manifestPath, null);
      if (!manifest || typeof manifest !== "object") throw new Error("manifest is not an object");
      if (!manifest.file) throw new Error("manifest is missing file");
      const videoFile = safePath(path.isAbsolute(manifest.file) ? manifest.file : path.join(path.dirname(manifestPath), manifest.file), ROOT);
      const stat = await fs.stat(videoFile);
      if (!stat.isFile()) throw new Error("file is not regular");
      result.push({ manifestPath, manifest, videoFile, stat });
    } catch (error) {
      log("Skipping", manifestPath, "-", error.message);
    }
  }
  return result;
}

async function loadState() {
  return readJson(STATE_FILE, { version: 1, items: {} });
}

function itemKey(entry) {
  return path.resolve(entry.manifestPath);
}

function signature(entry) {
  return `${entry.videoFile}:${entry.stat.size}:${entry.stat.mtimeMs}`;
}

async function saveState(state) {
  await writeJson(STATE_FILE, state);
}

function metadata(entry) {
  const m = entry.manifest;
  if (!m.title || typeof m.title !== "string") throw new Error(`${entry.manifestPath}: title is required`);
  const privacyStatus = ["private", "unlisted", "public"].includes(m.privacyStatus) ? m.privacyStatus : "private";
  return {
    snippet: {
      title: m.title,
      description: typeof m.description === "string" ? m.description : "",
      tags: Array.isArray(m.tags) ? m.tags.map(String) : [],
      categoryId: String(m.categoryId ?? "22"),
    },
    status: {
      privacyStatus,
      selfDeclaredMadeForKids: Boolean(m.madeForKids ?? false),
      license: m.license === "creativeCommon" ? "creativeCommon" : "youtube",
      embeddable: true,
      publicStatsViewable: true,
    },
  };
}

async function startUpload(entry, stateItem, state) {
  const stat = entry.stat;
  const contentType = "video/mp4";
  let session = stateItem.uploadSession;
  let nextByte = Number(stateItem.nextByte ?? 0);

  const statusOf = async () => {
    if (!session) return null;
    const response = await youtubeFetch(session, {
      method: "PUT",
      headers: { "content-length": "0", "content-range": `bytes */${stat.size}` },
    });
    if (response.status === 308) {
      const range = response.headers.get("range");
      return range ? Number(range.match(/-(\d+)$/)?.[1] ?? -1) + 1 : 0;
    }
    if (response.ok) return await response.json();
    if (response.status === 404) return null;
    throw new Error(`Upload status check failed (${response.status}): ${await response.text()}`);
  };

  if (session) {
    const status = await statusOf();
    if (status && typeof status === "object") return status;
    if (status !== null) nextByte = status;
    else { session = null; nextByte = 0; }
  }

  if (!session) {
    const body = JSON.stringify(metadata(entry));
    const response = await youtubeFetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=UTF-8",
        "content-length": String(Buffer.byteLength(body)),
        "x-upload-content-length": String(stat.size),
        "x-upload-content-type": contentType,
      },
      body,
    });
    if (!response.ok) throw new Error(`Could not start YouTube upload (${response.status}): ${await response.text()}`);
    session = response.headers.get("location");
    if (!session) throw new Error("YouTube did not return an upload session URL");
    nextByte = 0;
    stateItem.uploadSession = session;
    stateItem.nextByte = 0;
    await saveState(state);
  }

  const handle = await fs.open(entry.videoFile, "r");
  try {
    while (nextByte < stat.size) {
      const length = Math.min(CHUNK_SIZE, stat.size - nextByte);
      const buffer = Buffer.allocUnsafe(length);
      const read = await handle.read(buffer, 0, length, nextByte);
      const end = nextByte + read.bytesRead - 1;
      let response;
      for (let attempt = 0; ; attempt += 1) {
        try {
          response = await youtubeFetch(session, {
            method: "PUT",
            headers: {
              "content-type": contentType,
              "content-length": String(read.bytesRead),
              "content-range": `bytes ${nextByte}-${end}/${stat.size}`,
            },
            body: buffer.subarray(0, read.bytesRead),
          });
          if (![408, 429, 500, 502, 503, 504].includes(response.status) || attempt >= 5) break;
        } catch (error) {
          if (attempt >= 5) throw error;
          response = null;
        }
        await sleep(Math.min(60_000, 2 ** attempt * 2_000));
      }
      if (!response) throw new Error("Upload request failed without a response");
      if (response.status === 308) {
        const range = response.headers.get("range");
        nextByte = range ? Number(range.match(/-(\d+)$/)?.[1] ?? end) + 1 : end + 1;
        stateItem.nextByte = nextByte;
        await saveState(state);
        continue;
      }
      if (response.status === 200 || response.status === 201) {
        return await response.json();
      }
      throw new Error(`YouTube upload failed (${response.status}): ${await response.text()}`);
    }
  } finally {
    await handle.close();
  }
  throw new Error("Upload ended without a YouTube response");
}

async function processing(videoId) {
  const response = await youtubeFetch(`https://www.googleapis.com/youtube/v3/videos?part=status,processingDetails&id=${encodeURIComponent(videoId)}`);
  if (!response.ok) throw new Error(`Could not query YouTube processing (${response.status}): ${await response.text()}`);
  const item = (await response.json()).items?.[0];
  if (!item) throw new Error("YouTube no longer returned the uploaded video");
  return item;
}

async function processOne(entry, state) {
  const key = itemKey(entry);
  const current = state.items[key] ?? { status: "pending" };
  const sig = signature(entry);
  if (current.signature && current.signature !== sig) {
    Object.assign(current, { status: "pending", videoId: undefined, uploadSession: undefined, nextByte: 0, error: undefined });
  }
  current.signature = sig;
  current.manifestPath = entry.manifestPath;
  current.videoFile = entry.videoFile;
  current.updatedAt = new Date().toISOString();
  state.items[key] = current;

  if (current.status === "ready") return;
  if (current.nextAttemptAt && Date.parse(current.nextAttemptAt) > Date.now()) return;

  if (!current.videoId) {
    current.status = "uploading";
    await saveState(state);
    log("Uploading", entry.videoFile);
    const result = await startUpload(entry, current, state);
    current.videoId = result.id;
    current.url = `https://youtu.be/${result.id}`;
    current.status = "processing";
    current.uploadedAt = new Date().toISOString();
    current.uploadSession = undefined;
    current.nextByte = undefined;
    await saveState(state);
    log("Uploaded", current.url, "(YouTube processing pending)");
    return;
  }

  if (current.status === "processing") {
    const result = await processing(current.videoId);
    const status = result.processingDetails?.processingStatus;
    if (status === "succeeded" || result.status?.uploadStatus === "processed") {
      current.status = "ready";
      current.processedAt = new Date().toISOString();
      log("Ready for review", current.url);
    } else if (status === "failed") {
      throw new Error(`YouTube processing failed: ${result.processingDetails?.processingFailureReason ?? "unknown"}`);
    } else {
      log("Still processing", current.url, status ?? "unknown");
    }
    await saveState(state);
  }
}

async function runOnce() {
  const entries = await manifests();
  const state = await loadState();
  if (!entries.length) {
    log("No *.youtube.json manifests found; nothing to upload.");
    return;
  }
  for (const entry of entries) {
    try {
      await processOne(entry, state);
    } catch (error) {
      const current = state.items[itemKey(entry)] ?? { status: "failed" };
      current.status = "failed";
      current.error = error.message;
      current.attempts = Number(current.attempts ?? 0) + 1;
      current.nextAttemptAt = new Date(Date.now() + Math.min(60 * 60_000, 2 ** Math.min(current.attempts, 8) * 60_000)).toISOString();
      state.items[itemKey(entry)] = current;
      await saveState(state);
      log("Failed", entry.manifestPath, "-", error.message);
    }
  }
}

async function authorize() {
  const { clientId, clientSecret } = await readClientCredentials();
  const redirectUri = `http://localhost:${CALLBACK_PORT}/callback`;
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES.join(" "));
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");

  log("Open this URL in a browser on Ripley, then approve YouTube access:");
  console.log(authUrl.toString());
  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url, redirectUri);
    if (requestUrl.pathname !== "/callback") { response.end("Waiting for OAuth callback..."); return; }
    const code = requestUrl.searchParams.get("code");
    if (!code) { response.end("No authorization code received. You can close this tab."); server.close(); return; }
    try {
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
      });
      const data = await tokenResponse.json();
      if (!tokenResponse.ok || !data.refresh_token) throw new Error(JSON.stringify(data));
      await writeJson(TOKEN_FILE, { refresh_token: data.refresh_token, createdAt: new Date().toISOString(), scopes: SCOPES });
      response.end("Authorization complete. You can close this tab.");
      log("Authorization saved to", TOKEN_FILE);
      const channelResponse = await youtubeFetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true");
      const channel = channelResponse.ok ? (await channelResponse.json()).items?.[0] : null;
      if (channel) log("Authorized channel:", channel.snippet.title, `(${channel.id})`);
    } catch (error) {
      response.end("Authorization failed. Check the Ripley terminal.");
      log("Authorization failed:", error.message);
    } finally {
      server.close();
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(CALLBACK_PORT, "127.0.0.1", resolve);
  });
  await new Promise((resolve) => server.once("close", resolve));
}

async function doctor() {
  await readClientCredentials();
  await fs.mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  const entries = await manifests();
  log("Client credentials: present");
  log("Video root:", ROOT);
  log("Manifests discovered:", entries.length);
  if (await fs.stat(TOKEN_FILE).catch(() => null)) {
    await accessToken();
    log("YouTube refresh token: valid");
  } else {
    log("YouTube refresh token: not authorized yet");
  }
}

async function service() {
  log("YouTube uploader service watching", ROOT);
  for (;;) {
    await runOnce();
    await sleep(Math.max(15, POLL_SECONDS) * 1000);
  }
}

const command = process.argv[2] ?? "doctor";
try {
  if (command === "authorize") await authorize();
  else if (command === "doctor") await doctor();
  else if (command === "run-once") await runOnce();
  else if (command === "service") await service();
  else throw new Error(`Unknown command ${command}. Use authorize, doctor, run-once, or service.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
