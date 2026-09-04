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
