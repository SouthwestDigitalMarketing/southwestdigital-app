import "server-only";

import { EmailConnectionProvider, EmailConnectionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getFreshAccessToken } from "@/lib/emailConnections/repository";
import { parseZohoRegion } from "@/lib/emailConnections/providers";
import { zohoCanBlock, zohoCanTag } from "@/lib/emailConnections/zohoOAuth";
import {
  ZohoApiError,
  addZohoOrgSpamList,
  canReadZohoSpamList,
  findZohoOrgIds,
} from "@/lib/emailConnections/zohoMail";

export type BlockResult = {
  spam: number;
  allow: number;
  error?: string;
};

/**
 * Step 4 in Zoho itself (Tom, 2026-11-28): senders blocked forever go on the Zoho
 * organization's spam list (their mail lands in Spam, never rejected); senders
 * marked not spam go on its allow list. Uses the mailbox owner's SWapp connection.
 */
export async function blockInZoho(
  brandId: string,
  address: string,
  lists: { spam: string[]; allow: string[] },
): Promise<BlockResult> {
  const fail = (error: string): BlockResult => ({ spam: 0, allow: 0, error });
  const clean = (list: string[]) =>
    [...new Set(list.map((a) => a.trim().toLowerCase()))].filter((a) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a),
    );
  const spam = clean(lists.spam);
  const allow = clean(lists.allow);
  if (!spam.length && !allow.length) return { spam: 0, allow: 0 };
  const connection = await prisma.emailConnection.findFirst({
    where: {
      brandId,
      provider: EmailConnectionProvider.ZOHO,
      status: EmailConnectionStatus.ACTIVE,
      emailAddress: { equals: address, mode: "insensitive" },
    },
  });
  if (!connection?.accountIdentifier)
    return fail("Zoho is not connected in SWapp for this mailbox.");
  if (!zohoCanBlock(connection.scopes))
    return fail(
      "Reconnect Zoho in SWapp Settings so Donna can block senders in Zoho.",
    );
  const region = parseZohoRegion(connection.region);
  if (!region) return fail("The Zoho connection has no region.");
  try {
    const auth = {
      region,
      accessToken: await getFreshAccessToken(connection),
      accountId: connection.accountIdentifier,
    };
    let zoid: string | null = null;
    for (const id of await findZohoOrgIds(auth))
      if (await canReadZohoSpamList(auth, id)) {
        zoid = id;
        break;
      }
    if (!zoid)
      return fail(
        "Could not find your Zoho organization (an organization admin must connect).",
      );
    await addZohoOrgSpamList(auth, zoid, "spamEmail", spam);
    await addZohoOrgSpamList(auth, zoid, "whiteListEmail", allow);
    return { spam: spam.length, allow: allow.length };
  } catch (error) {
    return fail(
      error instanceof ZohoApiError
        ? `Zoho refused: ${error.status}`
        : "Could not reach Zoho.",
    );
  }
}

export type ZohoStatus = {
  connected: boolean;
  canTag: boolean;
  canBlock: boolean;
  /** The organization id was found and its spam list could be read. */
  organizationFound: boolean;
  error?: string;
};

/** Read-only check of the mailbox's Zoho connection, for the worker's status op. */
export async function zohoStatus(
  brandId: string,
  address: string,
): Promise<ZohoStatus> {
  const connection = await prisma.emailConnection.findFirst({
    where: {
      brandId,
      provider: EmailConnectionProvider.ZOHO,
      status: EmailConnectionStatus.ACTIVE,
      emailAddress: { equals: address, mode: "insensitive" },
    },
  });
  const base = {
    connected: Boolean(connection?.accountIdentifier),
    canTag: zohoCanTag(connection?.scopes),
    canBlock: zohoCanBlock(connection?.scopes),
    organizationFound: false,
  };
  if (!connection?.accountIdentifier || !base.canBlock) return base;
  const region = parseZohoRegion(connection.region);
  if (!region) return { ...base, error: "The Zoho connection has no region." };
  try {
    const auth = {
      region,
      accessToken: await getFreshAccessToken(connection),
      accountId: connection.accountIdentifier,
    };
    for (const id of await findZohoOrgIds(auth))
      if (await canReadZohoSpamList(auth, id))
        return { ...base, organizationFound: true };
    return base;
  } catch (error) {
    return {
      ...base,
      error:
        error instanceof ZohoApiError
          ? `Zoho refused: ${error.status}`
          : "Could not reach Zoho.",
    };
  }
}
