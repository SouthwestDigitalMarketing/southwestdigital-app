import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addZohoOrgSpamList,
  applyZohoLabel,
  canReadZohoSpamList,
  findZohoMessage,
  findZohoOrgIds,
  type ZohoAuth,
} from "./zohoMail";
import { zohoCanBlock, zohoCanTag } from "./zohoOAuth";

const auth: ZohoAuth = { region: "US", accessToken: "t", accountId: "123" };

afterEach(() => vi.unstubAllGlobals());

describe("Zoho tags", () => {
  it("needs read, update and tags before Donna may tag", () => {
    expect(zohoCanTag("ZohoMail.messages.CREATE,ZohoMail.accounts.READ")).toBe(
      false,
    );
    expect(zohoCanTag(null)).toBe(false);
    expect(
      zohoCanTag(
        "ZohoMail.messages.CREATE ZohoMail.accounts.READ ZohoMail.messages.READ ZohoMail.messages.UPDATE ZohoMail.tags.ALL",
      ),
    ).toBe(true);
    expect(zohoCanTag("ZohoMail.messages.ALL,ZohoMail.tags.ALL")).toBe(true);
  });

  it("matches on the Message-ID header and keeps long ids exact", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        if (url.includes("/messages/search"))
          return new Response(
            '{"data":[{"messageId":1560840837125110001,"folderId":9007199254740993,"subject":"Update"},' +
              '{"messageId":1560840837125110002,"folderId":9007199254740993,"subject":"Other"}]}',
          );
        return new Response(
          '{"data":{"headerContent":{"Message-Id":["<A@x.com>"]}}}',
        );
      }),
    );
    const id = await findZohoMessage(auth, {
      messageIdHeader: "<a@x.com>",
      from: "dan@x.com",
      subject: "Update",
      at: "2026-11-25T12:00:00Z",
    });
    expect(id).toBe("1560840837125110001");
    expect(decodeURIComponent(calls[0])).toContain(
      "sender:dan@x.com::fromDate:24-Nov-2026::toDate:26-Nov-2026",
    );
    expect(calls[1]).toContain(
      "/folders/9007199254740993/messages/1560840837125110001/header",
    );
    expect(calls).toHaveLength(2);
  });

  it("finds nothing when the header does not match", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("/search")
          ? new Response(
              '{"data":[{"messageId":1,"folderId":2,"subject":"Update"}]}',
            )
          : new Response(
              '{"data":{"headerContent":{"Message-Id":["<other@x.com>"]}}}',
            ),
      ),
    );
    expect(
      await findZohoMessage(auth, {
        messageIdHeader: "<a@x.com>",
        from: "d@x.com",
        subject: "Update",
        at: "2026-11-25T12:00:00Z",
      }),
    ).toBeNull();
  });

  it("sends label and message ids as unquoted longs", async () => {
    const fetchMock = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    await applyZohoLabel(auth, "77", ["1560840837125110001"]);
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(init.method).toBe("PUT");
    expect(init.body).toBe(
      '{"mode":"applyLabel","labelId":[77],"messageId":[1560840837125110001]}',
    );
    await expect(applyZohoLabel(auth, "77", ["1 OR 1"])).rejects.toThrow();
  });
});

describe("Zoho organization spam list", () => {
  it("needs the organization spam scope to block", () => {
    expect(zohoCanBlock("ZohoMail.messages.ALL,ZohoMail.tags.ALL")).toBe(false);
    expect(zohoCanBlock("ZohoMail.organization.spam.ALL ZohoMail.tags.ALL")).toBe(true);
  });

  it("finds the organization id from either documented place", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith("/api/organization")
          ? new Response("forbidden", { status: 403 })
          : new Response('{"data":[{"accountId":"123","policyId":{"zoid":9007199254740993}}]}'),
      ),
    );
    expect(await findZohoOrgIds(auth)).toEqual(["9007199254740993"]);
  });

  it("checks the id against the spam list before using it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 403 })));
    expect(await canReadZohoSpamList(auth, "55")).toBe(false);
  });

  it("puts blocked senders on spamEmail, keyed by the category", async () => {
    const fetchMock = vi.fn(async () => new Response('{"status":{"code":200}}'));
    vi.stubGlobal("fetch", fetchMock);
    await addZohoOrgSpamList(auth, "55", "spamEmail", ["a@x.com"]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://mail.zoho.com/api/organization/55/antispam/data");
    expect(init.method).toBe("PUT");
    expect(init.body).toBe('{"spamCategory":"spamEmail","spamEmail":["a@x.com"]}');
    await addZohoOrgSpamList(auth, "x; drop", "spamEmail", ["a@x.com"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
