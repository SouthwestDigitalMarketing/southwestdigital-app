import "server-only";

import { ZOHO_REGIONS, type ZohoRegionKey } from "./providers";
import { zohoTokenEndpoint } from "./zohoOAuth";

export class ZohoApiError extends Error {
  status: number;
  body: string;
  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = "ZohoApiError";
    this.status = status;
    this.body = body;
  }
}

export type ZohoTokenExchange = {
  accessToken: string;
  refreshToken: string | null;
  expiresInSeconds: number;
  scope: string | null;
};

async function zohoTokenRequest(endpoint: string, params: URLSearchParams): Promise<ZohoTokenExchange> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const text = await response.text();
  if (!response.ok) throw new ZohoApiError("Zoho token request failed", response.status, text);
  let json: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
  };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new ZohoApiError("Zoho returned a non-JSON token response", response.status, text);
  }
  if (json.error) throw new ZohoApiError(`Zoho returned error: ${json.error}`, response.status, text);
  if (!json.access_token) throw new ZohoApiError("Zoho response missing access_token", response.status, text);
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresInSeconds: typeof json.expires_in === "number" ? json.expires_in : 3600,
    scope: json.scope ?? null,
  };
}

export async function exchangeZohoAuthorizationCode(input: {
  region: ZohoRegionKey;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}) {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: input.redirectUri,
    code: input.code,
  });
  return zohoTokenRequest(zohoTokenEndpoint(input.region), params);
}

export async function refreshZohoAccessToken(input: {
  region: ZohoRegionKey;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}) {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: input.clientId,
    client_secret: input.clientSecret,
    refresh_token: input.refreshToken,
  });
  return zohoTokenRequest(zohoTokenEndpoint(input.region), params);
}

// Zoho Mail API uses its own bearer prefix ("Zoho-oauthtoken") rather than
// the standard "Bearer" scheme.
function zohoAuthHeader(accessToken: string) {
  return `Zoho-oauthtoken ${accessToken}`;
}

export type ZohoMailAccount = {
  accountId: string;
  primaryEmailAddress: string;
  displayName: string | null;
};

export async function fetchPrimaryZohoAccount(input: {
  region: ZohoRegionKey;
  accessToken: string;
}): Promise<ZohoMailAccount> {
  const host = ZOHO_REGIONS[input.region].mailApiHost;
  const response = await fetch(`https://${host}/api/accounts`, {
    headers: { Authorization: zohoAuthHeader(input.accessToken), Accept: "application/json" },
  });
  const text = await response.text();
  if (!response.ok) throw new ZohoApiError("Zoho accounts lookup failed", response.status, text);
  let payload: {
    data?: Array<{
      accountId?: string | number;
      primaryEmailAddress?: string;
      mailboxAddress?: string;
      accountDisplayName?: string;
      firstName?: string;
      lastName?: string;
    }>;
  };
  try {
    payload = JSON.parse(text) as typeof payload;
  } catch {
    throw new ZohoApiError("Zoho returned a non-JSON accounts response", response.status, text);
  }
  const first = payload.data?.[0];
  if (!first || (!first.accountId && first.accountId !== 0) || !(first.primaryEmailAddress || first.mailboxAddress)) {
    throw new ZohoApiError("Zoho account list was empty", response.status, text);
  }
  const displayName = first.accountDisplayName
    || [first.firstName, first.lastName].filter(Boolean).join(" ").trim()
    || null;
  return {
    accountId: String(first.accountId),
    primaryEmailAddress: String(first.primaryEmailAddress ?? first.mailboxAddress ?? ""),
    displayName,
  };
}

export type ZohoSendMessageInput = {
  region: ZohoRegionKey;
  accessToken: string;
  accountId: string;
  fromAddress: string;
  toAddress: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
};

export async function sendZohoMailMessage(input: ZohoSendMessageInput) {
  const host = ZOHO_REGIONS[input.region].mailApiHost;
  const url = `https://${host}/api/accounts/${encodeURIComponent(input.accountId)}/messages`;
  const body = {
    fromAddress: input.fromAddress,
    toAddress: input.toAddress,
    subject: input.subject,
    content: input.bodyHtml ?? input.bodyText,
    mailFormat: input.bodyHtml ? "html" : "plaintext",
  };
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: zohoAuthHeader(input.accessToken),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new ZohoApiError("Zoho send failed", response.status, text);
  try {
    return JSON.parse(text) as { data?: { messageId?: string } };
  } catch {
    return { data: undefined };
  }
}

export async function revokeZohoRefreshToken(input: {
  region: ZohoRegionKey;
  refreshToken: string;
}) {
  const params = new URLSearchParams({ token: input.refreshToken });
  const url = `${zohoTokenEndpoint(input.region).replace("/token", "/token/revoke")}?${params.toString()}`;
  try {
    await fetch(url, { method: "POST" });
  } catch {
    // best-effort — the local record is still deleted so the token is unused.
  }
}

// ─── Tags (Donna, 2026-11-26) ────────────────────────────────────────────────
// Zoho calls them labels in the API and tags in the app.

async function zohoJson<T>(input: {
  region: ZohoRegionKey;
  accessToken: string;
  path: string;
  method?: "GET" | "POST" | "PUT";
  /** A JSON string, sent as is (ids must stay unquoted longs). */
  body?: string;
  what: string;
}): Promise<T> {
  const host = ZOHO_REGIONS[input.region].mailApiHost;
  const response = await fetch(`https://${host}${input.path}`, {
    method: input.method ?? "GET",
    headers: {
      Authorization: zohoAuthHeader(input.accessToken),
      Accept: "application/json",
      ...(input.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: input.body,
  });
  const text = await response.text();
  if (!response.ok) throw new ZohoApiError(`Zoho ${input.what} failed`, response.status, text);
  try {
    // Zoho ids are longs past Number.MAX_SAFE_INTEGER: read them as strings.
    return JSON.parse(text.replace(/"(messageId|folderId|labelId|tagId|threadId|accountId|zoid)"\s*:\s*(\d+)/g, '"$1":"$2"')) as T;
  } catch {
    throw new ZohoApiError(`Zoho returned non-JSON for ${input.what}`, response.status, text);
  }
}

export type ZohoAuth = { region: ZohoRegionKey; accessToken: string; accountId: string };

function accountPath(auth: ZohoAuth, rest: string) {
  return `/api/accounts/${encodeURIComponent(auth.accountId)}${rest}`;
}

export async function listZohoLabels(auth: ZohoAuth) {
  const json = await zohoJson<{ data?: Array<{ labelId?: string | number; displayName?: string }> }>({
    ...auth,
    path: accountPath(auth, "/labels"),
    what: "label list",
  });
  return (json.data ?? []).flatMap((l) =>
    l.labelId !== undefined && l.displayName ? [{ labelId: String(l.labelId), name: l.displayName }] : [],
  );
}

export async function createZohoLabel(auth: ZohoAuth, name: string) {
  const json = await zohoJson<{ data?: { labelId?: string | number } }>({
    ...auth,
    path: accountPath(auth, "/labels"),
    method: "POST",
    body: JSON.stringify({ displayName: name }),
    what: "label create",
  });
  if (json.data?.labelId === undefined) throw new ZohoApiError("Zoho label create returned no id", 200, "");
  return String(json.data.labelId);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function zohoDate(d: Date) {
  return `${String(d.getUTCDate()).padStart(2, "0")}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
}

/**
 * Zoho's messageId for one email, matched on its Message-ID header. Zoho search cannot
 * search headers, so this searches by sender and a two-day window, then reads the
 * header of each candidate with the same subject. Null when no exact match.
 */
export async function findZohoMessage(
  auth: ZohoAuth,
  input: { messageIdHeader: string; from: string; subject: string; at: string },
) {
  const sent = new Date(input.at);
  if (Number.isNaN(sent.getTime()) || !input.from || !input.messageIdHeader) return null;
  const day = 86_400_000;
  const searchKey = [
    `sender:${input.from}`,
    `fromDate:${zohoDate(new Date(sent.getTime() - day))}`,
    `toDate:${zohoDate(new Date(sent.getTime() + day))}`,
  ].join("::");
  const params = new URLSearchParams({ searchKey, limit: "50", includeto: "false" });
  const json = await zohoJson<{
    data?: Array<{ messageId?: string | number; folderId?: string | number; subject?: string }>;
  }>({ ...auth, path: accountPath(auth, `/messages/search?${params}`), what: "message search" });
  const wanted = input.messageIdHeader.trim().toLowerCase();
  const subject = input.subject.trim().toLowerCase();
  const candidates = (json.data ?? []).filter(
    (m) => m.messageId !== undefined && m.folderId !== undefined && (m.subject ?? "").trim().toLowerCase() === subject,
  );
  for (const m of candidates.slice(0, 10)) {
    const header = await zohoJson<{ data?: { headerContent?: Record<string, string[]> } }>({
      ...auth,
      path: accountPath(auth, `/folders/${m.folderId}/messages/${m.messageId}/header?raw=false`),
      what: "message header",
    });
    const content = header.data?.headerContent ?? {};
    const ids = Object.entries(content)
      .filter(([k]) => k.toLowerCase() === "message-id")
      .flatMap(([, v]) => v)
      .map((v) => String(v).trim().toLowerCase());
    if (ids.includes(wanted)) return String(m.messageId);
  }
  return null;
}

export async function applyZohoLabel(auth: ZohoAuth, labelId: string, messageIds: string[]) {
  const ids = [labelId, ...messageIds];
  if (!messageIds.length || !ids.every((id) => /^\d{1,25}$/.test(id))) throw new Error("Zoho ids must be numeric.");
  await zohoJson<unknown>({
    ...auth,
    path: accountPath(auth, "/updatemessage"),
    method: "PUT",
    body: `{"mode":"applyLabel","labelId":[${labelId}],"messageId":[${messageIds.join(",")}]}`,
    what: "apply label",
  });
}

// ─── Organization spam list (Donna, 2026-11-28) ──────────────────────────────

/**
 * The Zoho organization id (zoid). Zoho's docs are unclear about which call an
 * org admin may use, so try the organization endpoint, then the zoid carried in
 * the account list; the caller checks the result against the spam list.
 */
export async function findZohoOrgIds(auth: ZohoAuth): Promise<string[]> {
  const ids: string[] = [];
  try {
    const org = await zohoJson<{ data?: { zoid?: string | number } | Array<{ zoid?: string | number }> }>({
      ...auth,
      path: "/api/organization",
      what: "organization",
    });
    const rows = Array.isArray(org.data) ? org.data : org.data ? [org.data] : [];
    for (const row of rows) if (row.zoid !== undefined) ids.push(String(row.zoid));
  } catch {
    // Not allowed for this token; try the account list.
  }
  try {
    const accounts = await zohoJson<{ data?: Array<{ accountId?: string; policyId?: { zoid?: string | number } }> }>({
      ...auth,
      path: "/api/accounts",
      what: "account list",
    });
    for (const a of accounts.data ?? [])
      if (a.policyId?.zoid !== undefined && String(a.accountId) === auth.accountId) ids.push(String(a.policyId.zoid));
  } catch {
    // No account list either.
  }
  return [...new Set(ids)].filter((id) => /^\d{1,25}$/.test(id));
}

/** True when this zoid's spam list can be read with this token. */
export async function canReadZohoSpamList(auth: ZohoAuth, zoid: string) {
  try {
    const params = new URLSearchParams({ spamCategory: "spamEmail", mode: "getMarkingData", limit: "1" });
    await zohoJson<unknown>({
      ...auth,
      path: `/api/organization/${zoid}/antispam/data?${params}`,
      what: "spam list",
    });
    return true;
  } catch {
    return false;
  }
}

export type ZohoSpamCategory = "spamEmail" | "whiteListEmail";

/** Add exact addresses to an organization spam list (spamEmail: to Spam; whiteListEmail: never spam). */
export async function addZohoOrgSpamList(
  auth: ZohoAuth,
  zoid: string,
  category: ZohoSpamCategory,
  addresses: string[],
) {
  if (!/^\d{1,25}$/.test(zoid) || !addresses.length) return;
  await zohoJson<unknown>({
    ...auth,
    path: `/api/organization/${zoid}/antispam/data`,
    method: "PUT",
    body: JSON.stringify({ spamCategory: category, [category]: addresses }),
    what: "spam list update",
  });
}
