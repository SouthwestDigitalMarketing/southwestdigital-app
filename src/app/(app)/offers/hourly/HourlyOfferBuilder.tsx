"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { buildHourlyCheckoutSummary } from "@/lib/engagements/hourlyCheckout";
import type { HourlyCatalogItem } from "@/lib/quotes/hourlyCatalog";
import { publishHourlyOfferAction, saveHourlyOfferDraftAction, type HourlyOfferSnapshot } from "./actions";

export type HourlyOfferInitialState = {
  offerId: string;
  kind: "consulting" | "coaching";
  published: boolean;
  publicPath: string | null;
  contactInfo: {
    companyName: string;
    invoicingEmail: string;
    primaryContact: { firstName: string; lastName: string; email: string; phone: string };
  };
  selection: {
    catalogItemId: string;
    catalogItemLabel: string;
    quantity: number;
    unitPrice: number;
    intakeFee: number;
  } | null;
  agreementTemplateId: string | null;
  agreementTemplateName: string | null;
  agreementText: string | null;
  isTestProposal: boolean;
  catalog: HourlyCatalogItem[];
  agreementTemplates: Array<{
    id: string;
    name: string;
    content: string;
    isDefault: boolean;
    defaultForProductKind: string | null;
  }>;
};

const INPUT = "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm";
const LABEL = "block text-xs font-semibold text-slate-700";

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

export function HourlyOfferBuilder({ initial }: { initial: HourlyOfferInitialState }) {
  const [companyName, setCompanyName] = useState(initial.contactInfo.companyName);
  const [invoicingEmail, setInvoicingEmail] = useState(initial.contactInfo.invoicingEmail);
  const [firstName, setFirstName] = useState(initial.contactInfo.primaryContact.firstName);
  const [lastName, setLastName] = useState(initial.contactInfo.primaryContact.lastName);
  const [contactEmail, setContactEmail] = useState(initial.contactInfo.primaryContact.email);
  const [contactPhone, setContactPhone] = useState(initial.contactInfo.primaryContact.phone);

  const initialCatalogItemId = initial.selection?.catalogItemId
    || initial.catalog[0]?.id
    || "";
  const [catalogItemId, setCatalogItemId] = useState(initialCatalogItemId);
  const initialItem = initial.catalog.find((c) => c.id === initialCatalogItemId) ?? initial.catalog[0];
  const [quantity, setQuantity] = useState<number>(initial.selection?.quantity ?? 1);
  const [unitPrice, setUnitPrice] = useState<number>(
    initial.selection?.unitPrice ?? initialItem?.defaultPrice ?? 0,
  );
  const [intakeFee, setIntakeFee] = useState<number>(initial.selection?.intakeFee ?? 0);
  const [isTestProposal, setIsTestProposal] = useState<boolean>(initial.isTestProposal);

  const [agreementTemplateId, setAgreementTemplateId] = useState<string | null>(initial.agreementTemplateId);
  const [savePending, startSave] = useTransition();
  const [publishPending, startPublish] = useTransition();
  const [status, setStatus] = useState<null | { kind: "saved" } | { kind: "published"; path: string } | { kind: "error"; message: string }>(null);

  const selectedCatalogItem = initial.catalog.find((c) => c.id === catalogItemId) ?? null;
  const selectedAgreement = initial.agreementTemplates.find((t) => t.id === agreementTemplateId) ?? null;

  const summary = useMemo(() => {
    if (!selectedCatalogItem || quantity <= 0) return null;
    try {
      return buildHourlyCheckoutSummary({
        kind: initial.kind,
        catalogItemId: selectedCatalogItem.id,
        catalogItemLabel: selectedCatalogItem.name,
        quantity,
        unitPrice,
        intakeFee,
      });
    } catch {
      return null;
    }
  }, [initial.kind, selectedCatalogItem, quantity, unitPrice, intakeFee]);

  function buildSnapshot(): HourlyOfferSnapshot | null {
    if (!selectedCatalogItem) return null;
    return {
      kind: initial.kind,
      contactInfo: {
        companyName: companyName.trim(),
        invoicingEmail: invoicingEmail.trim(),
        primaryContact: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: contactEmail.trim(),
          phone: contactPhone.trim(),
        },
      },
      selection: {
        catalogItemId: selectedCatalogItem.id,
        catalogItemLabel: selectedCatalogItem.name,
        quantity,
        unitPrice,
        intakeFee,
      },
      agreementTemplateId: selectedAgreement?.id ?? null,
      agreementTemplateName: selectedAgreement?.name ?? null,
      agreementText: selectedAgreement?.content ?? null,
      isTestProposal,
    };
  }

  function handleSave() {
    setStatus(null);
    const snapshot = buildSnapshot();
    if (!snapshot) {
      setStatus({ kind: "error", message: "Pick a service before saving." });
      return;
    }
    startSave(async () => {
      try {
        await saveHourlyOfferDraftAction(initial.offerId, snapshot);
        setStatus({ kind: "saved" });
      } catch (error) {
        setStatus({ kind: "error", message: error instanceof Error ? error.message : "Save failed" });
      }
    });
  }

  function handlePublish() {
    setStatus(null);
    const snapshot = buildSnapshot();
    if (!snapshot) {
      setStatus({ kind: "error", message: "Pick a service before publishing." });
      return;
    }
    startPublish(async () => {
      try {
        const result = await publishHourlyOfferAction(initial.offerId, snapshot);
        setStatus({ kind: "published", path: result.publicPath });
      } catch (error) {
        setStatus({ kind: "error", message: error instanceof Error ? error.message : "Publish failed" });
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Client</h2>
        <label className={LABEL}>
          Company
          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={INPUT} />
        </label>
        <label className={LABEL}>
          Invoicing email
          <input type="email" value={invoicingEmail} onChange={(e) => setInvoicingEmail(e.target.value)} className={INPUT} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={LABEL}>
            First name
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={INPUT} />
          </label>
          <label className={LABEL}>
            Last name
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={INPUT} />
          </label>
        </div>
        <label className={LABEL}>
          Primary contact email
          <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={INPUT} />
        </label>
        <label className={LABEL}>
          Primary contact phone
          <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={INPUT} />
        </label>

        <h2 className="mt-6 text-lg font-semibold text-slate-900">Service</h2>
        {initial.catalog.length === 0 ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            No {initial.kind} catalog services yet. Add rows to Services with product kind ={" "}
            <code>{initial.kind}</code> before continuing.
          </p>
        ) : (
          <>
            <label className={LABEL}>
              Catalog service
              <select
                value={catalogItemId}
                onChange={(e) => {
                  const next = e.target.value;
                  setCatalogItemId(next);
                  const nextItem = initial.catalog.find((c) => c.id === next);
                  if (nextItem) setUnitPrice(nextItem.defaultPrice);
                }}
                className={INPUT}
              >
                {initial.catalog.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            {selectedCatalogItem?.description ? (
              <p className="mt-1 text-xs text-slate-500">{selectedCatalogItem.description}</p>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <label className={LABEL}>
                Quantity
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                  className={INPUT}
                />
              </label>
              <label className={LABEL}>
                Unit price (USD)
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(Math.max(0, Number(e.target.value) || 0))}
                  className={INPUT}
                />
              </label>
            </div>
            <label className={LABEL}>
              Optional intake / onboarding fee (USD)
              <input
                type="number"
                min={0}
                step={1}
                value={intakeFee}
                onChange={(e) => setIntakeFee(Math.max(0, Number(e.target.value) || 0))}
                className={INPUT}
              />
            </label>
          </>
        )}

        <h2 className="mt-6 text-lg font-semibold text-slate-900">Agreement</h2>
        {initial.agreementTemplates.length === 0 ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            No agreement templates found. Create one at <Link href="/agreements" className="underline">/agreements</Link>.
          </p>
        ) : (
          <label className={LABEL}>
            Agreement template
            <select
              value={agreementTemplateId ?? ""}
              onChange={(e) => setAgreementTemplateId(e.target.value || null)}
              className={INPUT}
            >
              {initial.agreementTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                  {template.defaultForProductKind === initial.kind ? ` (default for ${initial.kind})` : ""}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={isTestProposal}
            onChange={(e) => setIsTestProposal(e.target.checked)}
          />
          Mark as a $1 test proposal (real signature, forced $1 charge)
        </label>
      </section>

      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Summary</h2>
        {summary ? (
          <div className="space-y-2 text-sm text-slate-700">
            <div className="flex justify-between">
              <span>
                {summary.quantity} × {summary.catalogItemLabel}
              </span>
              <span>{money(summary.subtotal)}</span>
            </div>
            {summary.intakeFee > 0 ? (
              <div className="flex justify-between">
                <span>Intake / onboarding fee</span>
                <span>{money(summary.intakeFee)}</span>
              </div>
            ) : null}
            <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-base font-semibold text-slate-900">
              <span>Total due at signing</span>
              <span>{isTestProposal ? "$1.00 (test)" : money(summary.total)}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Pick a service and enter a quantity to see the total.</p>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={savePending || publishPending}
            className="ui-action-ghost inline-flex h-10 items-center rounded-lg border border-slate-200 px-4 text-sm font-semibold disabled:opacity-50"
          >
            {savePending ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishPending || savePending || !summary}
            className="ui-action-primary inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold disabled:opacity-50"
          >
            {publishPending ? "Publishing…" : initial.published ? "Publish new version" : "Publish proposal"}
          </button>
        </div>

        {status?.kind === "saved" ? (
          <p className="text-sm text-emerald-800">Draft saved.</p>
        ) : null}
        {status?.kind === "published" ? (
          <p className="text-sm text-emerald-800">
            Published.{" "}
            <Link
              href={`${status.path}?staffPreview=1`}
              target="_blank"
              rel="noreferrer"
              className="font-semibold underline"
            >
              Preview as staff (opens in new tab)
            </Link>
            . Next step: send it from{" "}
            <Link href={`/offers/cover?offer=${initial.offerId}`} className="font-semibold underline">
              /offers/cover
            </Link>
            .
          </p>
        ) : null}
        {status?.kind === "error" ? (
          <p className="text-sm text-red-700">{status.message}</p>
        ) : null}

        {initial.publicPath ? (
          <p className="text-xs text-slate-500">
            <Link
              href={`${initial.publicPath}?staffPreview=1`}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Preview as staff (opens in new tab)
            </Link>
          </p>
        ) : null}
      </section>
    </div>
  );
}
