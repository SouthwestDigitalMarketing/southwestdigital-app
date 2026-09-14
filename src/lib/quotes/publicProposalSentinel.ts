export const PRIVATE_SENTINEL = "PRIVATE_SENTINEL_DO_NOT_PUBLISH";

export const sentinelCatalogRows = [
  {
    offerKey: "reports",
    code: "reports",
    name: "Reports",
    clientBenefit: "Monthly reporting for you",
    internalDescription: PRIVATE_SENTINEL,
  },
  {
    offerKey: "portal",
    code: "portal",
    name: "Portal",
    clientBenefit: "",
    internalDescription: PRIVATE_SENTINEL,
  },
];

export function sentinelBookkeepingSnapshot() {
  return {
    assessment: {
      assessmentNotes: PRIVATE_SENTINEL,
      discretionaryMultiplierNote: PRIVATE_SENTINEL,
      discretionaryMultiplier: 8,
      payrollContactEmail: PRIVATE_SENTINEL,
      adminAssistantPhone: PRIVATE_SENTINEL,
      packageNames: { grow: "Advisory", improve: "Momentum", maintain: "Essentials" },
      introHeadline: "Your bookkeeping plan",
      servicesInitialized: true,
      historicalCleanupPeriods: [
        { id: "2025", year: 2025, startMonth: 1, endMonth: 12, secret: PRIVATE_SENTINEL },
      ],
      additionalOptions: [{
        id: "reports",
        name: "Reports",
        description: PRIVATE_SENTINEL,
        monthlyPrice: 50,
        showInProposal: true,
        archived: false,
        applicabilityReason: PRIVATE_SENTINEL,
        packageIds: ["maintain", "improve", "grow"],
      }],
      bonuses: [{
        id: "portal",
        name: "Portal",
        description: PRIVATE_SENTINEL,
        archived: false,
        billingCadence: "monthly" as const,
        includedPlacement: "included" as const,
        defaultPackageIds: ["maintain", "improve", "grow"],
        applicabilityReason: PRIVATE_SENTINEL,
      }],
    },
    contactInfo: {
      companyName: "Example LLC",
      invoicingEmail: PRIVATE_SENTINEL,
      primaryContact: { sameAsOwner: true, ownerId: "owner" },
      owners: [{
        id: "owner",
        firstName: "Alex",
        lastName: "Example",
        email: "alex@example.test",
        phone: PRIVATE_SENTINEL,
        crmContactId: PRIVATE_SENTINEL,
        ownershipPercentage: PRIVATE_SENTINEL,
      }],
    },
    pricing: {
      maintain: { monthly: 500, breakdown: PRIVATE_SENTINEL },
      improve: { monthly: 600 },
      grow: { monthly: 750 },
      internal: PRIVATE_SENTINEL,
    },
    internal: PRIVATE_SENTINEL,
  };
}

export function sentinelHourlySnapshot() {
  return {
    kind: "consulting",
    contactInfo: {
      companyName: "Example LLC",
      invoicingEmail: PRIVATE_SENTINEL,
      primaryContact: {
        firstName: "Alex",
        lastName: "Example",
        email: "alex@example.test",
        phone: PRIVATE_SENTINEL,
        crmContactId: PRIVATE_SENTINEL,
      },
    },
    checkoutSummary: {
      kind: "consulting",
      catalogItemId: "consult",
      catalogItemLabel: "Consulting hour",
      quantity: 2,
      unitPrice: 150,
      intakeFee: 50,
      subtotal: 300,
      total: 350,
      amountDueNow: 350,
      chargeKind: "hourly_consulting",
      selectionHash: "hash",
      stripePaymentIntentId: PRIVATE_SENTINEL,
    },
    agreementText: "Public hourly agreement",
    agreementTemplateId: PRIVATE_SENTINEL,
    agreementTemplateName: PRIVATE_SENTINEL,
    assessmentNotes: PRIVATE_SENTINEL,
  };
}

export const HOURLY_PUBLIC_PROP_KEYS = [
  "alreadySigned",
  "agreementText",
  "brandAccent",
  "brandName",
  "clientName",
  "contact",
  "engagementId",
  "isStaffPreview",
  "isTestProposal",
  "kindLabel",
  "offer",
  "proposalToken",
] as const;
