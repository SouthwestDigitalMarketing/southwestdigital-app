type QuoteClientDetails = {
  name: string;
  email: string;
  company: string | null;
};

export type QuoteContactSummary = QuoteClientDetails & {
  contactId: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function quoteClientDetailsFromSnapshot(
  snapshot: unknown,
  fallback?: QuoteClientDetails,
): QuoteClientDetails {
  const resolved = resolveQuoteContactSummary(snapshot, fallback);
  return {
    name: resolved.name,
    email: resolved.email,
    company: resolved.company,
  };
}

export function quoteContactSummaryFromSnapshot(
  snapshot: unknown,
  fallback?: QuoteClientDetails,
): QuoteContactSummary {
  return resolveQuoteContactSummary(snapshot, fallback);
}

function resolveQuoteContactSummary(
  snapshot: unknown,
  fallback?: QuoteClientDetails,
): QuoteContactSummary {
  const record = isRecord(snapshot) ? snapshot : {};
  const contactInfo = isRecord(record.contactInfo) ? record.contactInfo : {};
  const primaryContact = isRecord(contactInfo.primaryContact) ? contactInfo.primaryContact : {};
  const owners = Array.isArray(contactInfo.owners) ? contactInfo.owners.filter(isRecord) : [];
  const primaryOwner = owners.find((owner) => text(owner.id) === text(primaryContact.ownerId));
  const resolved =
    primaryContact.sameAsOwner === true && primaryOwner ? primaryOwner : primaryContact;

  const primaryContactName = [text(resolved.firstName), text(resolved.lastName)]
    .filter(Boolean)
    .join(" ")
    .trim();
  const companyName = text(contactInfo.companyName) || fallback?.company || null;
  const email = text(contactInfo.invoicingEmail) || text(resolved.email) || fallback?.email || "";
  const contactId =
    text((primaryOwner as Record<string, unknown> | undefined)?.crmContactId) ||
    text((resolved as Record<string, unknown> | undefined)?.crmContactId) ||
    text((contactInfo.primaryContact as Record<string, unknown> | undefined)?.crmContactId) ||
    null;

  return {
    contactId,
    name: primaryContactName || text(contactInfo.companyName) || fallback?.name || "Untitled offer",
    email,
    company: companyName,
  };
}
