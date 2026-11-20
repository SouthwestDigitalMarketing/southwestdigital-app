-- AlterTable
ALTER TABLE "Engagement" ADD COLUMN     "gsaClientFolder" TEXT,
ADD COLUMN     "gsaDraftedAt" TIMESTAMP(3),
ADD COLUMN     "gsaSentAt" TIMESTAMP(3),
ADD COLUMN     "gsaSignedAt" TIMESTAMP(3);
