-- CreateTable
CREATE TABLE "ServiceRecord" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "engagementId" TEXT,
    "product" TEXT NOT NULL,
    "basis" TEXT NOT NULL,
    "feeAmount" DECIMAL(65,30),
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "endReason" TEXT,
    "evidenceSource" TEXT NOT NULL,
    "evidenceRef" TEXT NOT NULL,
    "evidenceDate" DATE NOT NULL,
    "notes" TEXT,
    "previousId" TEXT,
    "sourceKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceRecord_previousId_key" ON "ServiceRecord"("previousId");

-- CreateIndex
CREATE INDEX "ServiceRecord_brandId_basis_startDate_idx" ON "ServiceRecord"("brandId", "basis", "startDate");

-- CreateIndex
CREATE INDEX "ServiceRecord_contactId_idx" ON "ServiceRecord"("contactId");

-- CreateIndex
CREATE INDEX "ServiceRecord_engagementId_idx" ON "ServiceRecord"("engagementId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceRecord_brandId_sourceKey_key" ON "ServiceRecord"("brandId", "sourceKey");

-- AddForeignKey
ALTER TABLE "ServiceRecord" ADD CONSTRAINT "ServiceRecord_previousId_fkey" FOREIGN KEY ("previousId") REFERENCES "ServiceRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRecord" ADD CONSTRAINT "ServiceRecord_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRecord" ADD CONSTRAINT "ServiceRecord_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRecord" ADD CONSTRAINT "ServiceRecord_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Rules from concepts/service-records-design (service-records step 2).
ALTER TABLE "ServiceRecord"
  ADD CONSTRAINT "ServiceRecord_basis_check" CHECK ("basis" IN ('monthly', 'one_time', 'hourly')),
  ADD CONSTRAINT "ServiceRecord_product_check" CHECK ("product" ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  ADD CONSTRAINT "ServiceRecord_evidence_source_check" CHECK ("evidenceSource" IN ('swapp_proposal', 'qbo_contract', 'agreement_file', 'paid_invoice')),
  ADD CONSTRAINT "ServiceRecord_evidence_ref_check" CHECK (length(btrim("evidenceRef")) > 0),
  -- A monthly record counts toward MRR, so it needs its fee and signed evidence.
  ADD CONSTRAINT "ServiceRecord_monthly_terms_check" CHECK ("basis" <> 'monthly' OR ("feeAmount" IS NOT NULL AND "feeAmount" > 0 AND "evidenceSource" <> 'paid_invoice')),
  ADD CONSTRAINT "ServiceRecord_fee_check" CHECK ("feeAmount" IS NULL OR "feeAmount" >= 0),
  ADD CONSTRAINT "ServiceRecord_end_check" CHECK (("endDate" IS NULL) = ("endReason" IS NULL)),
  ADD CONSTRAINT "ServiceRecord_end_reason_check" CHECK ("endReason" IS NULL OR "endReason" IN ('job_done', 'client_cancelled', 'terminated_by_us', 'agreement_ended', 'replaced', 'lapsed')),
  ADD CONSTRAINT "ServiceRecord_dates_check" CHECK ("endDate" IS NULL OR "endDate" >= "startDate");
