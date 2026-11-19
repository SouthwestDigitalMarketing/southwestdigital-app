export const TOOL_LINK_KEYS = ["quickbooks", "double", "calendar", "mail", "skool", "website"] as const;

export type ToolLinkKey = (typeof TOOL_LINK_KEYS)[number];

export type ToolLink = {
  key: ToolLinkKey;
  label: string;
  url: string;
  sortOrder: number;
};

export const DEFAULT_TOOL_LINKS: ToolLink[] = [
  {
    key: "quickbooks",
    label: "QuickBooks",
    url: "https://app.qbo.intuit.com/app/login",
    sortOrder: 0,
  },
  {
    key: "double",
    label: "Double",
    url: "https://app.doublehq.com/",
    sortOrder: 1,
  },
  {
    key: "calendar",
    label: "Calendar",
    url: "https://mail.zoho.com/zm/#calendar/wk",
    sortOrder: 2,
  },
  {
    key: "mail",
    label: "Mail",
    url: "https://mail.zoho.com/zm/#mail/folder/inbox",
    sortOrder: 3,
  },
  {
    key: "skool",
    label: "Skool",
    url: "https://www.skool.com/login",
    sortOrder: 4,
  },
  {
    key: "website",
    label: "Website",
    url: "",
    sortOrder: 5,
  },
];

// The public site differs per brand, so the Website link's default comes from
// the brand slug. A brand not listed here shows no Website link until an admin
// sets one in Settings.
export const BRAND_WEBSITES: Record<string, string> = {
  "bookkeeping-conroe": "https://www.bookkeepingconroe.com/",
};

export function defaultToolLinks(brandSlug?: string): ToolLink[] {
  return DEFAULT_TOOL_LINKS.map((link) =>
    link.key === "website" ? { ...link, url: (brandSlug && BRAND_WEBSITES[brandSlug]) || "" } : link,
  );
}

export function isToolLinkKey(value: string): value is ToolLinkKey {
  return (TOOL_LINK_KEYS as readonly string[]).includes(value);
}

export function parseToolUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Enter a full URL, starting with https://");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Tool links must use https://");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Tool links cannot include a username or password.");
  }
  if (parsed.href.length > 2048) {
    throw new Error("That URL is too long.");
  }

  return parsed.href;
}

export function mergeToolLinks(
  stored: Array<{ key: string; label: string; url: string; sortOrder: number }>,
  brandSlug?: string,
): ToolLink[] {
  const byKey = new Map(stored.filter((link) => isToolLinkKey(link.key)).map((link) => [link.key, link]));

  return defaultToolLinks(brandSlug).map((fallback) => {
    const existing = byKey.get(fallback.key);
    if (!existing) return fallback;
    return {
      key: fallback.key,
      label: existing.label.trim() || fallback.label,
      url: existing.url.trim(),
      sortOrder: existing.sortOrder,
    };
  });
}

export function visibleToolLinks(links: ToolLink[]): ToolLink[] {
  return links.filter((link) => {
    if (!link.url) return false;
    try {
      return Boolean(parseToolUrl(link.url));
    } catch {
      return false;
    }
  });
}
