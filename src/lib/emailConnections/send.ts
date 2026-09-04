import "server-only";

import { EmailConnectionProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getFreshAccessToken, markEmailConnectionError } from "./repository";
import { parseZohoRegion } from "./providers";
import { sendZohoMailMessage, ZohoApiError } from "./zohoMail";

// Thrown when the current user hasn't connected a mailbox for this brand.
// Callers surface this to the UI as a "Connect your mailbox in Settings"
// message.
export class EmailConnectionMissingError extends Error {
  constructor() {
    super("Connect your mailbox in Settings to send email from the app.");
    this.name = "EmailConnectionMissingError";
  }
}

export class EmailConnectionRegionInvalidError extends Error {
  constructor() {
    super("Your Zoho connection has an invalid region. Reconnect from Settings.");
    this.name = "EmailConnectionRegionInvalidError";
  }
}

export type SendMailInput = {
  membershipId: string;
  brandId: string;
  to: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
};

export type SendMailResult = {
  provider: EmailConnectionProvider;
  fromAddress: string;
  messageId: string | null;
};

// Send an email using the given membership's connected mailbox. Only Zoho is
// supported today; Gmail / Microsoft / SMTP will be dispatched here as they
// come online.
export async function sendFromMembership(input: SendMailInput): Promise<SendMailResult> {
  const connection = await prisma.emailConnection.findFirst({
    where: { brandId: input.brandId, membershipId: input.membershipId },
  });
  if (!connection) throw new EmailConnectionMissingError();

  if (connection.provider !== EmailConnectionProvider.ZOHO) {
    throw new Error(`Provider ${connection.provider} is not available for sending yet.`);
  }
  if (!connection.accountIdentifier) {
    throw new Error("Reconnect Zoho — the mailbox account identifier is missing.");
  }
  const region = parseZohoRegion(connection.region);
  if (!region) throw new EmailConnectionRegionInvalidError();

  try {
    const accessToken = await getFreshAccessToken(connection);
    const response = await sendZohoMailMessage({
      region,
      accessToken,
      accountId: connection.accountIdentifier,
      fromAddress: connection.emailAddress,
      toAddress: input.to,
      subject: input.subject,
      bodyText: input.bodyText,
      bodyHtml: input.bodyHtml,
    });
    return {
      provider: connection.provider,
      fromAddress: connection.emailAddress,
      messageId: response?.data?.messageId ?? null,
    };
  } catch (error) {
    const message = error instanceof ZohoApiError
      ? `Zoho rejected the send (${error.status}): ${error.body.slice(0, 300)}`
      : error instanceof Error
        ? error.message
        : "Unknown send failure";
    await markEmailConnectionError(connection.id, message).catch(() => undefined);
    throw error;
  }
}
