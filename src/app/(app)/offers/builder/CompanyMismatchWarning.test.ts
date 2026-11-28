import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../who/actions", () => ({
  searchOfferContactsAction: vi.fn(async () => []),
}));

import { CompanyMismatchWarning } from "./CompanyMismatchWarning";

function render(props: {
  offerId?: string;
  contactCompany?: string | null;
  proposalCompany?: string | null;
  frozen?: boolean;
}) {
  return renderToStaticMarkup(
    createElement(CompanyMismatchWarning, {
      offerId: "offer123",
      contactCompany: null,
      proposalCompany: null,
      ...props,
    }),
  );
}

describe("CompanyMismatchWarning SSR states", () => {
  it("renders nothing on a match", () => {
    expect(render({ contactCompany: "BBQ Grill People, Inc.", proposalCompany: "bbq grill people" })).toBe("");
  });

  it("renders nothing when either side is empty (unknown)", () => {
    expect(render({ contactCompany: null, proposalCompany: "Acme" })).toBe("");
    expect(render({ contactCompany: "Acme", proposalCompany: "" })).toBe("");
  });

  it("treats Smith & Sons LLC and smith and sons as the same company", () => {
    expect(render({ contactCompany: "Smith & Sons LLC", proposalCompany: "smith and sons" })).toBe("");
  });

  it("warns with both companies and a relink link on mismatch (unaccepted quote)", () => {
    const html = render({ contactCompany: "Mike's BBQ Shack", proposalCompany: "Arnett Holdings" });
    expect(html).toContain("role=\"alert\"");
    expect(html).toContain(
      "The linked contact&#x27;s company (Mike&#x27;s BBQ Shack) differs from this proposal&#x27;s company (Arnett Holdings).",
    );
    expect(html).toContain("Relink the contact");
    expect(html).toContain('href="/offers?highlight=offer123"');
  });

  it("warns without a relink action on frozen quotes", () => {
    const html = render({
      contactCompany: "Mike's BBQ Shack",
      proposalCompany: "Arnett Holdings",
      frozen: true,
    });
    expect(html).toContain("differs from this proposal&#x27;s company");
    expect(html).not.toContain("Relink the contact");
    expect(html).not.toContain("highlight");
  });
});
