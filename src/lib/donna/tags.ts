import "server-only";

import { EmailConnectionProvider, EmailConnectionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getFreshAccessToken } from "@/lib/emailConnections/repository";
import { parseZohoRegion } from "@/lib/emailConnections/providers";
import { zohoCanTag } from "@/lib/emailConnections/zohoOAuth";
import {
  ZohoApiError,
  applyZohoLabel,
  createZohoLabel,
  findZohoMessage,
  listZohoLabels,
  type ZohoAuth,
} from "@/lib/emailConnections/zohoMail";

export type TagRequest = {
  thread: string;
  tag: string;
  messages: { id: string; from: string; subject: string; at: string }[];
};

export type TagResult = { thread: string; tag: string; tagged: number; error?: string };

/**
 * Step 2 client tags (Tom, 2026-11-26): tag each email in Zoho with its client's name,
 * through the mailbox owner's SWapp Zoho connection. Creates the tag the first time.
 * Each thread is reported on its own; one failure never blocks the others.
 */
export async function tagThreads(
  brandId: string,
  address: string,
  requests: TagRequest[],
): Promise<{ results: TagResult[]; error?: string }> {
  const connection = await prisma.emailConnection.findFirst({
    where: {
      brandId,
      provider: EmailConnectionProvider.ZOHO,
      status: EmailConnectionStatus.ACTIVE,
      emailAddress: { equals: address, mode: "insensitive" },
    },
  });
  const fail = (error: string) => ({
    results: requests.map((r) => ({ thread: r.thread, tag: r.tag, tagged: 0, error })),
    error,
  });
  if (!connection?.accountIdentifier) return fail("Zoho is not connected in SWapp for this mailbox.");
  if (!zohoCanTag(connection.scopes))
    return fail("Reconnect Zoho in SWapp Settings so Donna can tag mail.");
  const region = parseZohoRegion(connection.region);
  if (!region) return fail("The Zoho connection has no region.");
  let auth: ZohoAuth;
  let labels: { labelId: string; name: string }[];
  try {
    auth = { region, accessToken: await getFreshAccessToken(connection), accountId: connection.accountIdentifier };
    labels = await listZohoLabels(auth);
  } catch (error) {
    return fail(error instanceof ZohoApiError ? `Zoho refused: ${error.status}` : "Could not reach Zoho.");
  }
  const results: TagResult[] = [];
  for (const request of requests) {
    try {
      let label = labels.find((l) => l.name.toLowerCase() === request.tag.toLowerCase());
      if (!label) {
        label = { labelId: await createZohoLabel(auth, request.tag), name: request.tag };
        labels.push(label);
      }
      const ids: string[] = [];
      for (const message of request.messages) {
        const id = await findZohoMessage(auth, {
          messageIdHeader: message.id,
          from: message.from,
          subject: message.subject,
          at: message.at,
        });
        if (id) ids.push(id);
      }
      if (!ids.length) {
        results.push({ thread: request.thread, tag: request.tag, tagged: 0, error: "Email not found in Zoho." });
        continue;
      }
      await applyZohoLabel(auth, label.labelId, ids);
      results.push({ thread: request.thread, tag: request.tag, tagged: ids.length });
    } catch (error) {
      results.push({
        thread: request.thread,
        tag: request.tag,
        tagged: 0,
        error: error instanceof ZohoApiError ? `Zoho refused: ${error.status}` : "Tagging failed.",
      });
    }
  }
  return { results };
}
