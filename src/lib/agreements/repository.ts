import "server-only";

import { prisma } from "@/lib/prisma";
import {
  DEFAULT_AGREEMENT_TEMPLATE_KEY,
  DEFAULT_AGREEMENT_TEMPLATE_NAME,
  DEFAULT_BOOKKEEPING_AGREEMENT_TEMPLATE,
} from "./template";

export async function ensureDefaultAgreementTemplate(brandId: string) {
  const currentDefault = await prisma.agreementTemplate.findFirst({
    where: { brandId, status: "active", isDefault: true },
  });
  if (currentDefault) return currentDefault;

  return prisma.$transaction(async (transaction) => {
    const template = await transaction.agreementTemplate.upsert({
      where: {
        brandId_key: { brandId, key: DEFAULT_AGREEMENT_TEMPLATE_KEY },
      },
      create: {
        brandId,
        key: DEFAULT_AGREEMENT_TEMPLATE_KEY,
        name: DEFAULT_AGREEMENT_TEMPLATE_NAME,
        description: "Default agreement for recurring bookkeeping and cleanup engagements.",
        content: DEFAULT_BOOKKEEPING_AGREEMENT_TEMPLATE,
        status: "active",
        isDefault: false,
      },
      update: { status: "active", archivedAt: null },
    });
    await transaction.agreementTemplate.updateMany({
      where: { brandId, id: { not: template.id } },
      data: { isDefault: false },
    });
    return transaction.agreementTemplate.update({
      where: { id: template.id },
      data: { isDefault: true },
    });
  });
}
