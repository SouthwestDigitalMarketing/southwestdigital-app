const DIVIDER = "─".repeat(62);
const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const DEFAULT_EXCLUSIONS = [
  "Tax preparation, tax planning, or tax filing of any kind",
  "CPA, enrolled agent, or licensed tax preparer services",
  "Payroll processing (unless separately agreed in writing)",
  "Financial statements intended for bank loan applications, audits, or regulatory filings (unless separately agreed in writing)",
  "Legal, compliance, or regulatory advice",
  "Business consulting beyond the scope of bookkeeping",
  "Forensic accounting or fraud investigation",
];

export interface ProposalAgreementInput {
  brandName: string;
  clientName: string;
  primaryContactName?: string | null;
  primaryContactEmail?: string | null;
  selectedTierLabel?: string | null;
  onboardingFee?: number | null;
  hasCleanup?: boolean;
}

export function generateProposalAgreementText(input: ProposalAgreementInput): string {
  const { brandName, clientName, primaryContactName, primaryContactEmail, selectedTierLabel, onboardingFee, hasCleanup } = input;

  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const obFee = onboardingFee ?? 0;
  const tierStr = selectedTierLabel ? `${selectedTierLabel} package` : "selected bookkeeping package";
  const engagementTypeStr = hasCleanup ? "Historical Cleanup + Monthly Bookkeeping" : "Monthly Bookkeeping";

  const sections: string[] = [];

  sections.push([
    "BOOKKEEPING SERVICES AGREEMENT",
    DIVIDER,
    "",
    `Client:           ${clientName}`,
    primaryContactName ? `Contact:          ${primaryContactName}${primaryContactEmail ? " | " + primaryContactEmail : ""}` : null,
    `Date:             ${today}`,
    `Engagement:       ${engagementTypeStr}`,
    `Package:          ${tierStr}`,
  ].filter(Boolean).join("\n"));

  const scopeText = hasCleanup
    ? `${brandName} will perform monthly bookkeeping services and historical cleanup/catchup bookkeeping for ${clientName}. The specific cleanup period, accounts, and deliverables will be confirmed during the discovery phase following execution of this agreement and payment of the engagement fee.`
    : `${brandName} will provide ongoing monthly bookkeeping services for ${clientName}. The specific accounts, reporting schedule, and deliverables will be confirmed during the onboarding process.`;
  sections.push(["SCOPE OF WORK", DIVIDER, "", scopeText].join("\n"));

  const feeLines = obFee > 0
    ? `Engagement Fee:         ${fmt(obFee)}  (due upon signing)\n\nFull scope will be confirmed during the discovery phase that follows signing and payment.`
    : `Engagement Fee:         To be confirmed\n\nFull scope will be confirmed during the discovery phase that follows signing and payment.`;
  sections.push(["FEE STRUCTURE", DIVIDER, "", feeLines].join("\n"));

  sections.push(["DOCUMENT SUBMISSION TIMELINE", DIVIDER, "",
    "Onboarding work begins once the engagement fee has been paid and required documents have been received.",
    "",
    `  • Documents are due within 10 business days of the engagement fee clearing.`,
    `  • If documents are not received within that window, ${brandName} cannot guarantee the client's place in the active work queue. The engagement will be rescheduled behind clients who are ready to proceed.`,
    `  • If documents are not received within 30 days of payment, a $150/month file-maintenance fee applies to keep the engagement open.`,
    `  • If documents are not received within 60 days of payment, the engagement will be placed on hold. Scope and pricing will be reconfirmed before work resumes.`,
    `  • The engagement fee is fully earned upon signing and is non-refundable regardless of how long document submission takes.`,
  ].join("\n"));

  const exclusionLines = DEFAULT_EXCLUSIONS.map((e) => `  • ${e}`).join("\n");
  sections.push(["EXCLUSIONS", DIVIDER, "",
    "The following services are not included in this engagement unless separately agreed in writing:",
    "",
    exclusionLines,
  ].join("\n"));

  sections.push(["TERMS AND CONDITIONS", DIVIDER, "",
    "1. Confidentiality",
    `All client financial information provided to ${brandName} will be kept strictly confidential and will not be shared with third parties except as required by law or with written consent from the client.`,
    "",
    "2. Electronic Communications",
    `${brandName} may communicate with the client by email or other electronic means. The client is responsible for keeping its own email accounts, passwords, and devices secure, and ${brandName} may rely on instructions received from an email address or account the client has identified as its own, unless ${brandName} has reason to believe the communication is not genuine. Electronic communications can be delayed, intercepted, or corrupted in transit; ${brandName} is not responsible for those risks once a message has been sent.`,
    "",
    "3. Client Cooperation",
    `This engagement depends on the client providing complete, accurate, and timely information and records. ${brandName} is not responsible for errors, omissions, or delays resulting from incomplete or inaccurate information provided by the client.`,
    "",
    "4. Unanticipated and Out-of-Scope Services",
    `Only the services described in this agreement are included. If an unanticipated need arises — such as an audit, an amended tax return, or a financial statement required for a loan application — ${brandName} will provide a separate quote before performing that work. That work will begin only after the client agrees to the pricing and provides signed authorization.`,
    "",
    "5. Client Responsibilities",
    `The client is responsible for providing accurate, complete records and information, and for making relevant staff and documents available to ${brandName} as needed to complete the engagement. Advice or recommendations offered by ${brandName} are based on its knowledge, training, and experience; final business decisions remain the client's.`,
    "",
    "6. Ownership of Documents",
    `Original documents provided during this engagement remain the property of the client. ${brandName} may retain copies of client documents for its own records.`,
    "",
    "7. Proprietary Materials",
    `The templates, checklists, workflows, and other materials ${brandName} uses to deliver its services were developed independently of this engagement and remain ${brandName}'s property. The client may use materials provided during the engagement for its own internal recordkeeping but may not copy, resell, or share them with a third party without ${brandName}'s written consent.`,
    "",
    "8. Record Retention and Third-Party Platforms",
    `${brandName} may use third-party or cloud-based platforms for bookkeeping, file storage, and service delivery. ${brandName} is not responsible for data access, continuity, or availability issues caused by those third-party platforms, and the client remains responsible for maintaining its own copies of original documents. ${brandName} retains engagement records for active clients for the duration of the engagement, and for seven (7) years following termination.`,
    "",
    "9. Termination",
    `Either party may terminate this agreement with seven (7) days written notice. All fees for work completed through the termination date are due upon termination, and any deposit or prepayment on file will be applied against amounts owed as of that date.`,
    "",
    "10. Payment Terms and Delinquent Accounts",
    `Invoices are due upon receipt unless other terms are agreed to in writing. ${brandName} may pause work on any engagement with a delinquent invoice until the account is brought current. The client agrees to reimburse ${brandName} for reasonable collection costs, including attorneys' fees, incurred in collecting a delinquent balance.`,
    "",
    "11. Retainers",
    `${brandName} may request a retainer before starting services on an engagement. Retainer funds are held and applied against future invoices for that engagement. If the engagement ends with a retainer balance remaining, ${brandName} will refund the balance within sixty (60) days of termination or upon the client's request, whichever is sooner.`,
    "",
    "12. Service and Price Guarantee",
    `${brandName} stands behind the quality of its work. If the client is dissatisfied with services performed, the client should notify ${brandName} promptly so it can be addressed — which may include correcting the work, adjusting pricing, or issuing a partial or full credit, at ${brandName}'s discretion.`,
    "",
    "13. Indemnification",
    `The client agrees to indemnify and hold ${brandName} harmless from claims, damages, or costs arising out of inaccurate or incomplete information provided by the client, or out of the client's business operations, except to the extent such claims arise from ${brandName}'s gross negligence or willful misconduct.`,
    "",
    "14. Limitation of Liability",
    `${brandName}'s liability under this agreement is limited to the fees paid under this agreement. ${brandName} is not liable for tax, legal, audit, or financial outcomes based on the work product of this engagement.`,
    "",
    "15. Governing Law, Venue, and Attorneys' Fees",
    "This agreement is governed by the laws of the State of Texas. Any action related to this agreement must be brought in the state or federal courts located in Montgomery County, Texas, and both parties consent to the jurisdiction of those courts. The prevailing party in any such action is entitled to recover its reasonable attorneys' fees and court costs.",
    "",
    "16. Entire Agreement",
    "This agreement, together with any schedules or exhibits referenced in it, constitutes the entire agreement between the parties and supersedes all prior discussions, understandings, or agreements, whether written or oral, relating to this engagement.",
    "",
    "17. Severability",
    "If any provision of this agreement is found to be invalid or unenforceable, the remaining provisions will remain in full force and effect.",
    "",
    "18. Electronic Signature",
    "The client agrees that signing this agreement electronically has the same legal effect as a handwritten signature.",
  ].join("\n"));

  sections.push(["SIGNATURE", DIVIDER, "",
    "By signing below, the client confirms they have read, understood, and agreed to the terms of this agreement.",
    "",
    `Business: ${clientName}`,
    `Date: ${today}`,
  ].join("\n"));

  return sections.join("\n\n\n");
}
