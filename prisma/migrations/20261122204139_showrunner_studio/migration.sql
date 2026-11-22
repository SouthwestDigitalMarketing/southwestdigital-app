-- CreateTable
CREATE TABLE "ShowrunnerStudio" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "mountainCurrent" INTEGER,
    "showDollars" BOOLEAN NOT NULL DEFAULT false,
    "episodes" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShowrunnerStudio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShowrunnerStudio_brandId_key" ON "ShowrunnerStudio"("brandId");

-- AddForeignKey
ALTER TABLE "ShowrunnerStudio" ADD CONSTRAINT "ShowrunnerStudio_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
