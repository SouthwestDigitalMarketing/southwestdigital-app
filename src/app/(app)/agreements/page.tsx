import { requireStaffBrand } from "@/lib/brands/staff";
import { prisma } from "@/lib/prisma";
import { IssuedAgreementsTable } from "./IssuedAgreementsTable";

export default async function AgreementsPage() {
  const { brand } = await requireStaffBrand();

  const agreements = await prisma.engagement.findMany({
    where: {
      brandId: brand.id,
      OR: [
        { agreementText: { not: null } },
        { agreementSentAt: { not: null } },
        { signedAt: { not: null } },
      ],
    },
    orderBy: [{ signedAt: "desc" }, { agreementSentAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      clientName: true,
      primaryContactName: true,
      primaryContactEmail: true,
      agreementText: true,
      agreementSentAt: true,
      signedAt: true,
      agreementManagerStatus: true,
      agreementCancellationRequestedAt: true,
      agreementCancellationReason: true,
      onboardingFeeStatus: true,
      createdAt: true,
      quotes: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true } },
    },
  });

  return (
    <div className="agreements-readable p-8">
      <IssuedAgreementsTable agreements={agreements} />
    </div>
  );
}
