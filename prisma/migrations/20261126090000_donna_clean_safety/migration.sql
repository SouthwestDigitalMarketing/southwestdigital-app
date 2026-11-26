-- AlterTable
ALTER TABLE "DonnaJob" ADD COLUMN     "options" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "result" JSONB;
