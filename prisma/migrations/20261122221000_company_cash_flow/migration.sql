CREATE TABLE "CompanyCashFlowMonth" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "incomeUsd" DECIMAL(12,2) NOT NULL,
    "expensesUsd" DECIMAL(12,2) NOT NULL,
    "ownerDrawUsd" DECIMAL(12,2) NOT NULL,
    "taxSetAsideUsd" DECIMAL(12,2) NOT NULL,
    "sourceAccounts" JSONB NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompanyCashFlowMonth_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CompanyCashFlowMonth_month_key" ON "CompanyCashFlowMonth"("month");
