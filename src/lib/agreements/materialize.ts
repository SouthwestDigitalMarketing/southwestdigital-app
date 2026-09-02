import "server-only";

import { getSchemaCapabilities } from "@/lib/database/schemaCapabilities";
import { prisma } from "@/lib/prisma";
import { ensureDefaultAgreementTemplate } from "./repository";
import {
  DEFAULT_AGREEMENT_TEMPLATE_NAME,
  DEFAULT_BOOKKEEPING_AGREEMENT_TEMPLATE,
} from "./template";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function materializeAgreementTemplate(brandId: string, value: unknown) {
  if (!isRecord(value)) return value;

  const { agreementTemplates } = await getSchemaCapabilities();
  if (!agreementTemplates) {
    return {
      ...value,
      agreementTemplateId: "built-in-bookkeeping-services",
      agreementTemplateName: DEFAULT_AGREEMENT_TEMPLATE_NAME,
      agreementTemplateContent: DEFAULT_BOOKKEEPING_AGREEMENT_TEMPLATE,
    };
  }

  const requestedId =
    typeof value.agreementTemplateId === "string"
      ? value.agreementTemplateId.trim()
      : "";
  const requested = requestedId
    ? await prisma.agreementTemplate.findFirst({
        where: { id: requestedId, brandId },
      })
    : null;
  const selected = requested ?? (await ensureDefaultAgreementTemplate(brandId));

  return {
    ...value,
    agreementTemplateId: selected.id,
    agreementTemplateName: selected.name,
    agreementTemplateContent: selected.content,
  };
}
