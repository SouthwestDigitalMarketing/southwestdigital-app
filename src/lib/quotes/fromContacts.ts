import { formatEvenOwnershipShare, splitContactName } from "@/lib/contacts/name";

type SourceContact = {
  id: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phoneE164?: string | null;
  phoneNumber?: string | null;
  company?: string | null;
  roleTitle?: string | null;
};

function personName(contact: SourceContact) {
  return {
    firstName: contact.firstName?.trim() || splitContactName(contact.name).firstName,
    lastName: contact.lastName?.trim() || splitContactName(contact.name).lastName,
  };
}

export function contactInfoFromCrm(contacts: SourceContact[]) {
  if (contacts.length === 0) return undefined;
  const share = formatEvenOwnershipShare(contacts.length);
  const owners = contacts.map((contact) => {
    const name = personName(contact);
    const phone = contact.phoneE164 || contact.phoneNumber || "";
    return {
      id: contact.id,
      crmContactId: contact.id,
      firstName: name.firstName,
      lastName: name.lastName,
      email: contact.email ?? "",
      phone,
      ownershipPercentage: share,
    };
  });
  const primary = contacts[0];
  const primaryName = personName(primary);
  const companyName = contacts.map((item) => item.company?.trim()).find(Boolean) ?? "";

  return {
    companyName,
    invoicingEmail: primary.email ?? "",
    invoicingOwnerId: primary.id,
    owners,
    primaryContact: {
      sameAsOwner: true,
      ownerId: primary.id,
      firstName: primaryName.firstName,
      lastName: primaryName.lastName,
      email: primary.email ?? "",
      phone: primary.phoneE164 || primary.phoneNumber || "",
      role: primary.roleTitle?.trim() || "Owner / Founder",
    },
  };
}

export function assessmentFromCrm(contacts: SourceContact[]) {
  if (contacts.length === 0) return undefined;
  const primary = contacts[0];
  return {
    clientName: primary.name,
    contactEmail: primary.email ?? "",
    contactPhone: primary.phoneE164 || primary.phoneNumber || "",
    contactRole: primary.roleTitle?.trim() || "Owner / Founder",
    companyName: contacts.map((item) => item.company?.trim()).find(Boolean) ?? "",
  };
}
