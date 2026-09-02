function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function offerHasCleanup(assessment: unknown) {
  return isRecord(assessment) && assessment.booksOverTwoMonthsBehind === true;
}

export function extractOfferEngagementFields(snapshot: {
  contactInfo?: unknown;
  assessment?: unknown;
}) {
  const contactInfo = isRecord(snapshot.contactInfo) ? snapshot.contactInfo : {};
  const assessment = isRecord(snapshot.assessment) ? snapshot.assessment : {};
  const primaryContact = isRecord(contactInfo.primaryContact) ? contactInfo.primaryContact : {};
  const owners = Array.isArray(contactInfo.owners) ? contactInfo.owners.filter(isRecord) : [];
  const primaryOwner = owners.find((owner) => text(owner.id) === text(primaryContact.ownerId));
  const resolved = primaryContact.sameAsOwner === true && primaryOwner ? primaryOwner : primaryContact;
  const companyName =
    text(contactInfo.companyName) || text(assessment.companyName) || "Untitled proposal";
  const primaryContactName =
    [text(resolved.firstName), text(resolved.lastName)].filter(Boolean).join(" ") || null;

  return {
    clientName: companyName,
    clientLegalName: companyName,
    primaryContactName,
    primaryContactEmail: text(resolved.email) || null,
    primaryContactPhone: text(resolved.phone) || null,
    billingContactEmail: text(contactInfo.invoicingEmail) || text(resolved.email) || null,
    hasCleanup: offerHasCleanup(assessment),
  };
}
