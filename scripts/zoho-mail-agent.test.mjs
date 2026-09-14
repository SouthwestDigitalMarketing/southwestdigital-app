import { describe, expect, it } from "vitest";
import { buildDraftPayload, normalizeMessage, parseOriginalMessage, ZOHO_AGENT_SCOPES } from "./zoho-mail-agent.mjs";

describe("Zoho mail agent safety boundary", () => {
  it("requests read/create/folder access but no update or delete scopes", () => {
    expect(ZOHO_AGENT_SCOPES).toEqual([
      "ZohoMail.accounts.READ",
      "ZohoMail.messages.READ",
      "ZohoMail.messages.CREATE",
      "ZohoMail.folders.READ",
    ]);
    expect(ZOHO_AGENT_SCOPES.some((scope) => scope.endsWith(".UPDATE") || scope.endsWith(".DELETE"))).toBe(false);
  });

  it("normalizes a Zoho list row without mutating mailbox state", () => {
    expect(normalizeMessage({
      messageId: 123,
      folderId: 456,
      fromAddress: "client@example.com",
      subject: "Question",
      receivedTime: "1760000000000",
      status: "0",
      hasAttachment: "1",
    })).toMatchObject({
      messageId: "123",
      folderId: "456",
      from: "client@example.com",
      subject: "Question",
      unread: true,
      hasAttachment: true,
    });
  });

  it("extracts headers needed for a threaded reply", () => {
    const parsed = parseOriginalMessage(
      "From: Client <client@example.com>\r\n" +
        "Reply-To: replies@example.com\r\n" +
        "Subject: Help\r\n" +
        "Message-ID: <message-2@example.com>\r\n" +
        "References: <message-1@example.com>\r\n\r\n" +
        "Please help.",
    );
    expect(parsed.headers["message-id"]).toBe("<message-2@example.com>");
    expect(parsed.body).toBe("Please help.");
  });

  it("can only construct a draft payload", () => {
    const payload = buildDraftPayload({
      mailbox: { emailAddress: "agent@example.com" },
      original: {
        headers: {
          from: "Client <client@example.com>",
          subject: "Question",
          "message-id": "<message-2@example.com>",
          references: "<message-1@example.com>",
        },
      },
      body: "Thanks — I will look into this.",
    });
    expect(payload).toMatchObject({
      mode: "draft",
      fromAddress: "agent@example.com",
      toAddress: "client@example.com",
      subject: "Re: Question",
      inReplyTo: "<message-2@example.com>",
      refHeader: "<message-1@example.com> <message-2@example.com>",
    });
    expect(payload).not.toHaveProperty("send");
  });
});
