-- CreateTable
CREATE TABLE "ScorecardMonthly" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScorecardMonthly_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScorecardMonthly_brandId_metric_month_key" ON "ScorecardMonthly"("brandId", "metric", "month");

-- AddForeignKey
ALTER TABLE "ScorecardMonthly" ADD CONSTRAINT "ScorecardMonthly_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
