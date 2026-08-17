import { createServer } from "http";
import { readFileSync } from "fs";
import { URL } from "url";

// Read from .env.local
const env = readFileSync(".env.local", "utf8");
const get = (key) => env.match(new RegExp(`^${key}=(.+)$`, "m"))?.[1]?.trim().replace(/^["']|["']$/g, "");

const CLIENT_ID = get("YOUTUBE_OAUTH_CLIENT_ID");
const CLIENT_SECRET = get("YOUTUBE_OAUTH_CLIENT_SECRET");
const REDIRECT_URI = "http://localhost:4567/callback";
const SCOPE = [
  "https://www.googleapis.com/auth/yt-analytics.readonly",
  "https://www.googleapis.com/auth/youtube.readonly",
].join(" ");

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Missing YOUTUBE_OAUTH_CLIENT_ID or YOUTUBE_OAUTH_CLIENT_SECRET in .env.local");
  process.exit(1);
}

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", CLIENT_ID);
authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", SCOPE);
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");

console.log("\nOpen this URL in your browser:\n");
console.log(authUrl.toString());
console.log("\nWaiting for authorization...\n");

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost:4567");
  if (url.pathname !== "/callback") return;

  const code = url.searchParams.get("code");
  if (!code) {
    res.end("No code received.");
    return;
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  const data = await tokenRes.json();

  if (data.refresh_token) {
    console.log("✅ Success! Your new refresh token:\n");
    console.log(data.refresh_token);
    console.log("\nAdd this as YOUTUBE_REFRESH_TOKEN_BC in Netlify and .env.local\n");
    res.end("Got it! Check your terminal for the refresh token. You can close this tab.");
  } else {
    console.error("Failed:", data);
    res.end("Error — check terminal.");
  }

  server.close();
});

server.listen(4567);
