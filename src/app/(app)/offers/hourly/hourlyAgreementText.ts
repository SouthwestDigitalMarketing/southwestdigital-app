export type HourlyAgreementFields = {
  companyName: string;
  firstName: string;
  lastName: string;
  contactEmail: string;
  date?: Date;
};

/**
 * Resolve an agreement template to final hourly text. The hourly builder has
 * no bookkeeping fee inputs, so it fills only the contact facts it owns and
 * drops every other placeholder (including {{volumeClause}}, which never
 * applies to hourly offers). Saved hourly text must never contain raw {{…}}.
 * Already-saved/signed text is never passed back through here.
 */
export function buildHourlyAgreementText(
  templateContent: string | null,
  fields: HourlyAgreementFields,
): string | null {
  if (templateContent == null) return null;
  const name = [fields.firstName.trim(), fields.lastName.trim()].filter(Boolean).join(" ");
  const email = fields.contactEmail.trim();
  const contactLine = name
    ? `Contact:          ${name}${email ? ` | ${email}` : ""}`
    : email
      ? `Contact:          ${email}`
      : "";
  const clientName = fields.companyName.trim() || "Client";
  const date = (fields.date ?? new Date()).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return templateContent
    .replaceAll("{{clientName}}", clientName)
    .replaceAll("{{contactLine}}", contactLine)
    .replaceAll("{{date}}", date)
    .replace(/\{\{[^}]+\}\}/g, "");
}
