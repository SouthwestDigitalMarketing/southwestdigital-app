"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import ProposalAppCollapsibleSection from "./ProposalAppCollapsibleSection";
import type { ProposalAppCollapsibleForceSignal } from "./ProposalAppCollapsibleSection";
import PricingSnapshotSidebar from "./PricingSnapshotSidebar";
import ProposalAppDemoHeader from "./ProposalAppDemoHeader";
import ProposalAppExpandAllControl from "./ProposalAppExpandAllControl";
import {
  ENTITY_TYPE_OPTIONS,
  BOOK_SET_OPTIONS,
  REAL_ESTATE_OPERATIONS,
  getProposalPricingSnapshotCleanupCard,
  getProposalPricingSnapshotItems,
  QBO_ACCESS_STATUS_OPTIONS,
  TAX_ELECTION_OPTIONS,
  useProposalAssessmentDemoState,
} from "./ProposalCreationWorkspaceDemo";
import {
  formatPersonName,
  resolvePrimaryContact,
  useProposalContactInfoDemoState,
  type InvoicingRecipientSource,
  type ContactInfoState,
} from "./ProposalContactInfoState";
import type { AssessmentState } from "./ProposalCreationWorkspaceDemo";

const PRIMARY_CONTACT_ROLE_OPTIONS = [
  "Select...",
  "Owner / Founder",
  "Managing Member",
  "Member",
  "Partner",
  "President",
  "CEO",
  "COO",
  "Controller",
  "CFO",
  "Office Manager",
  "Operations Manager",
  "Property Manager",
  "Executive Assistant",
  "Bookkeeper",
  "Unknown",
  "Other",
] as const;

const INPUT_CLASS_NAME =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm transition focus:border-brandnavy focus:outline-none focus:ring-2 focus:ring-brandnavy/10";
const FIELD_LABEL_CLASS =
  "text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500";

export default function ProposalContactInfoDemo({
  engagementId,
  initialContactInfo,
  initialAssessment,
}: {
  engagementId?: string;
  initialContactInfo?: Partial<ContactInfoState>;
  initialAssessment?: Partial<AssessmentState>;
}) {
  const {
    contactInfo,
    updateField,
    updateOwner,
    addOwner,
    removeOwner,
    updatePrimaryContact,
  } = useProposalContactInfoDemoState({ engagementId, initialContactInfo });
  const { assessment, updateAssessment, toggleOperation } = useProposalAssessmentDemoState({
    engagementId,
    initialAssessment,
  });
  const [expandAllSignal, setExpandAllSignal] = useState<ProposalAppCollapsibleForceSignal>({
    value: false,
    token: 0,
  });
  const ownerCount = contactInfo.owners.length;
  const showRealEstateFields = assessment.bookSetType === "real-estate-only" || assessment.bookSetType === "mixed-books";
  const taxElectionOwnerMismatch =
    assessment.taxElection === "disregarded" && ownerCount > 1
      ? "This book set is marked as a disregarded entity (single-member), but multiple owners are listed. Confirm the tax election or adjust the owner list."
      : assessment.taxElection === "partnership" && ownerCount < 2
        ? "This book set is marked as a partnership, but only one owner is listed. Confirm the tax election or add the other owner(s)."
        : null;

  const selectedInvoicingOwner =
    contactInfo.owners.find((owner) => owner.id === contactInfo.invoicingOwnerId) ?? null;
  const resolvedPrimaryContact = resolvePrimaryContact(contactInfo);
  const resolvedPrimaryContactFirstName = resolvedPrimaryContact.firstName;
  const resolvedPrimaryContactLastName = resolvedPrimaryContact.lastName;
  const resolvedPrimaryContactEmail = resolvedPrimaryContact.email;
  const resolvedPrimaryContactPhone = resolvedPrimaryContact.phone;
  const resolvedInvoicingEmail =
    contactInfo.invoicingRecipientSource === "primary-contact"
      ? resolvedPrimaryContactEmail
      : contactInfo.invoicingRecipientSource === "business-owner"
        ? selectedInvoicingOwner?.email ?? ""
        : contactInfo.invoicingEmail;

  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto w-full max-w-[1720px] px-5 py-6 lg:px-8">
        <div>
          <ProposalAppDemoHeader
            currentStep="contact"
            previousHref="/offers/who?kind=bookkeeping"
            nextHref="/offers/scale"
          />

            {contactInfo.owners.some((owner) => owner.crmContactId) ? (
              <p className="mt-4 text-sm text-slate-500">
                These people come from Contacts. Saving this offer also updates their contact
                records (name, email, phone, company, and role).
              </p>
            ) : null}

            <div className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_440px] 2xl:grid-cols-[minmax(0,1.55fr)_470px]">
            <div className="space-y-3">
              <div className="flex justify-start px-1">
                <ProposalAppExpandAllControl
                  onExpandAll={() => setExpandAllSignal({ value: true, token: Date.now() })}
                  onCollapseAll={() => setExpandAllSignal({ value: false, token: Date.now() })}
                />
              </div>
              <section className="proposal-builder-card overflow-hidden rounded-[1.5rem] border border-slate-300 shadow-sm">
                <ProposalAppCollapsibleSection
                  title="Company / Book Set"
                  forceOpen={expandAllSignal}
                >
                  <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <FieldLabel label="Name (as it appears in their QBO file)">
                      <input
                        value={contactInfo.companyName}
                        onChange={(event) => updateField("companyName", event.target.value)}
                        className={INPUT_CLASS_NAME}
                      />
                    </FieldLabel>

                    <FieldLabel label="QBO Access Status">
                      <select
                        value={assessment.qboAccessStatus}
                        onChange={(event) =>
                          updateAssessment(
                            "qboAccessStatus",
                            event.target.value as typeof assessment.qboAccessStatus,
                          )
                        }
                        className={INPUT_CLASS_NAME}
                      >
                        {QBO_ACCESS_STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </FieldLabel>
                  </div>

                  <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <FieldLabel label="Entity Type">
                      <select
                        value={assessment.entityType}
                        onChange={(event) =>
                          updateAssessment("entityType", event.target.value as typeof assessment.entityType)
                        }
                        className={INPUT_CLASS_NAME}
                      >
                        {ENTITY_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </FieldLabel>
                    <FieldLabel label="Tax Election">
                      <select
                        value={assessment.taxElection}
                        onChange={(event) =>
                          updateAssessment("taxElection", event.target.value as typeof assessment.taxElection)
                        }
                        className={INPUT_CLASS_NAME}
                      >
                        {TAX_ELECTION_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </FieldLabel>
                  </div>
                </ProposalAppCollapsibleSection>

                <ProposalAppCollapsibleSection
                  title="Industry Type"
                  forceOpen={expandAllSignal}
                >
                  <FieldLabel label="Book Set Type">
                    <select value={assessment.bookSetType} onChange={(event) => updateAssessment("bookSetType", event.target.value as typeof assessment.bookSetType)} className={INPUT_CLASS_NAME}>
                      {BOOK_SET_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </FieldLabel>
                  {showRealEstateFields ? (
                    <div className="mt-4">
                      <p className="text-sm font-semibold text-slate-700">Real Estate Details</p>
                      <div className="mt-4 flex flex-wrap gap-3">
                        {REAL_ESTATE_OPERATIONS.map((operation) => {
                          const selected = assessment.realEstateOperations.includes(operation.value);
                          return <button key={operation.value} type="button" onClick={() => toggleOperation(operation.value)} className={`proposal-builder-option rounded-full border px-4 py-2 text-sm font-semibold transition ${selected ? "border-brandnavy bg-brandnavy text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"}`}>{operation.label}</button>;
                        })}
                      </div>
                    </div>
                  ) : null}
                </ProposalAppCollapsibleSection>

                <ProposalAppCollapsibleSection
                  title="Business Owners"
                  forceOpen={expandAllSignal}
                >
                  {taxElectionOwnerMismatch ? (
                    <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>{taxElectionOwnerMismatch}</p>
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    {contactInfo.owners.map((owner, index) => {
                      const isLastOwner = index === contactInfo.owners.length - 1;

                      return (
                        <div key={owner.id}>
                          <div className="flex items-center justify-between gap-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                              Owner {index + 1}
                            </p>
                            {contactInfo.owners.length > 1 ? (
                              <button
                                type="button"
                                onClick={() => removeOwner(owner.id)}
                                className="text-sm font-semibold text-slate-500 transition hover:text-slate-900"
                              >
                                Remove
                              </button>
                            ) : null}
                          </div>

                          <div
                            className={`mt-3 grid gap-3 ${
                              isLastOwner
                                ? "xl:grid-cols-[minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1.2fr)_minmax(0,1fr)_120px_140px]"
                                : "xl:grid-cols-[minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1.2fr)_minmax(0,1fr)_120px]"
                            }`}
                          >
                            <FieldLabel label="First Name">
                              <input
                                value={owner.firstName}
                                onChange={(event) =>
                                  updateOwner(owner.id, "firstName", event.target.value)
                                }
                                className={INPUT_CLASS_NAME}
                              />
                            </FieldLabel>
                            <FieldLabel label="Last Name">
                              <input
                                value={owner.lastName}
                                onChange={(event) =>
                                  updateOwner(owner.id, "lastName", event.target.value)
                                }
                                className={INPUT_CLASS_NAME}
                              />
                            </FieldLabel>
                            <FieldLabel label="Email">
                              <input
                                type="email"
                                value={owner.email}
                                onChange={(event) =>
                                  updateOwner(owner.id, "email", event.target.value)
                                }
                                className={INPUT_CLASS_NAME}
                              />
                            </FieldLabel>
                            <FieldLabel label="Phone">
                              <input
                                value={owner.phone}
                                onChange={(event) =>
                                  updateOwner(owner.id, "phone", event.target.value)
                                }
                                className={INPUT_CLASS_NAME}
                              />
                            </FieldLabel>
                            <FieldLabel label="Ownership %">
                              <input
                                value={owner.ownershipPercentage}
                                onChange={(event) =>
                                  updateOwner(owner.id, "ownershipPercentage", event.target.value)
                                }
                                className={INPUT_CLASS_NAME}
                              />
                            </FieldLabel>
                            {isLastOwner ? (
                              <div className="grid gap-2">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-transparent">
                                  Add
                                </span>
                                <button
                                  type="button"
                                  onClick={addOwner}
                                  className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                                >
                                  Add Owner
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ProposalAppCollapsibleSection>

                <ProposalAppCollapsibleSection
                  title="Primary Contact"
                  forceOpen={expandAllSignal}
                >
                  <label className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={contactInfo.primaryContact.sameAsOwner}
                      onChange={(event) =>
                        updatePrimaryContact("sameAsOwner", event.target.checked)
                      }
                      className="h-4 w-4 rounded border-slate-300 text-brandnavy focus:ring-brandnavy"
                    />
                    Same as owner
                  </label>

                  {contactInfo.primaryContact.sameAsOwner ? (
                    <div className="mt-3 max-w-[420px]">
                      <FieldLabel label="Owner">
                        <select
                          value={contactInfo.primaryContact.ownerId}
                          onChange={(event) => updatePrimaryContact("ownerId", event.target.value)}
                          className={INPUT_CLASS_NAME}
                        >
                          {contactInfo.owners.map((owner) => (
                            <option key={owner.id} value={owner.id}>
                              {formatPersonName(owner.firstName, owner.lastName) || "Unnamed owner"}
                            </option>
                          ))}
                        </select>
                      </FieldLabel>
                    </div>
                  ) : null}

                  <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1.2fr)_minmax(0,1fr)_220px]">
                    <FieldLabel label="First Name">
                      <input
                        value={resolvedPrimaryContactFirstName}
                        onChange={(event) =>
                          updatePrimaryContact("firstName", event.target.value)
                        }
                        className={INPUT_CLASS_NAME}
                        readOnly={contactInfo.primaryContact.sameAsOwner}
                      />
                    </FieldLabel>
                    <FieldLabel label="Last Name">
                      <input
                        value={resolvedPrimaryContactLastName}
                        onChange={(event) =>
                          updatePrimaryContact("lastName", event.target.value)
                        }
                        className={INPUT_CLASS_NAME}
                        readOnly={contactInfo.primaryContact.sameAsOwner}
                      />
                    </FieldLabel>
                    <FieldLabel label="Email">
                      <input
                        type="email"
                        value={resolvedPrimaryContactEmail}
                        onChange={(event) => updatePrimaryContact("email", event.target.value)}
                        className={INPUT_CLASS_NAME}
                        readOnly={contactInfo.primaryContact.sameAsOwner}
                      />
                    </FieldLabel>
                    <FieldLabel label="Phone">
                      <input
                        value={resolvedPrimaryContactPhone}
                        onChange={(event) => updatePrimaryContact("phone", event.target.value)}
                        className={INPUT_CLASS_NAME}
                        readOnly={contactInfo.primaryContact.sameAsOwner}
                      />
                    </FieldLabel>
                    <FieldLabel label="Title / Role">
                      <select
                        value={contactInfo.primaryContact.role}
                        onChange={(event) => updatePrimaryContact("role", event.target.value)}
                        className={INPUT_CLASS_NAME}
                      >
                        {PRIMARY_CONTACT_ROLE_OPTIONS.map((option) => (
                          <option key={option} value={option === "Select..." ? "" : option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      </FieldLabel>
                    </div>
                </ProposalAppCollapsibleSection>

                <ProposalAppCollapsibleSection
                  title="Invoicing Email"
                  forceOpen={expandAllSignal}
                >
                  <div className="mt-3 grid gap-3 xl:grid-cols-[220px_220px_minmax(0,1fr)]">
                    <FieldLabel label="Use">
                      <select
                        value={contactInfo.invoicingRecipientSource}
                        onChange={(event) =>
                          updateField(
                            "invoicingRecipientSource",
                            event.target.value as InvoicingRecipientSource,
                          )
                        }
                        className={INPUT_CLASS_NAME}
                      >
                        <option value="primary-contact">Primary Contact</option>
                        <option value="business-owner">Business Owner</option>
                        <option value="custom">Custom</option>
                      </select>
                    </FieldLabel>

                    {contactInfo.invoicingRecipientSource === "business-owner" ? (
                      <>
                        <FieldLabel label="Business Owner">
                          <select
                            value={contactInfo.invoicingOwnerId}
                            onChange={(event) =>
                              updateField("invoicingOwnerId", event.target.value)
                            }
                            className={INPUT_CLASS_NAME}
                          >
                            {contactInfo.owners.map((owner) => (
                              <option key={owner.id} value={owner.id}>
                                {formatPersonName(owner.firstName, owner.lastName) || "Unnamed owner"}
                              </option>
                            ))}
                          </select>
                        </FieldLabel>
                        <FieldLabel label="Email Address">
                          <input
                            type="email"
                            value={resolvedInvoicingEmail}
                            className={INPUT_CLASS_NAME}
                            readOnly
                          />
                        </FieldLabel>
                      </>
                    ) : (
                      <FieldLabel label="Email Address" className="xl:col-span-2">
                        <input
                          type="email"
                          value={
                            contactInfo.invoicingRecipientSource === "custom"
                              ? contactInfo.invoicingEmail
                              : resolvedInvoicingEmail
                          }
                          onChange={(event) => updateField("invoicingEmail", event.target.value)}
                          className={INPUT_CLASS_NAME}
                          readOnly={contactInfo.invoicingRecipientSource !== "custom"}
                        />
                      </FieldLabel>
                    )}
                  </div>
                </ProposalAppCollapsibleSection>
              </section>
            </div>

            <PricingSnapshotSidebar
              items={getProposalPricingSnapshotItems(assessment)}
              cleanupCard={getProposalPricingSnapshotCleanupCard(assessment)}
            />
          </div>
        </div>
      </section>
    </main>
  );
}

function FieldLabel({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`grid content-start gap-2 ${className ?? ""}`}>
      <span className={FIELD_LABEL_CLASS}>{label}</span>
      {children}
    </label>
  );
}
