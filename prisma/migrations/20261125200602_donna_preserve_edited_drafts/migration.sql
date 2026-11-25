-- AlterTable
ALTER TABLE "DonnaRequest" ADD COLUMN     "draftEdited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "draftStale" BOOLEAN NOT NULL DEFAULT false;
