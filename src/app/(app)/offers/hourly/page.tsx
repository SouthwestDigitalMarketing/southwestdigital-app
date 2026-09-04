import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireQuoteStaff } from "@/lib/quotes/access";
import { isHourlyOfferKind, OFFER_KINDS, type OfferKindKey } from "@/lib/quotes/kinds";
import { loadHourlyCatalog } from "@/lib/quotes/hourlyCatalog";
import { ensureDefaultAgreementTemplate } from "@/lib/agreements/repository";
import { getSchemaCapabilities } from "@/lib/database/schemaCapabilities";
import { HourlyOfferBuilder, type HourlyOfferInitialState } from "./HourlyOfferBuilder";

type SearchParams = Promise<{
  kind?: string;
  offer?: string;
  contacts?: string;
  contact?: string;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export default async function HourlyOfferBuilderPage({ searchParams }: { searchParams: SearchParams }) {
  const { brand } = await requireQuoteStaff();
  const params = await searchParams;
  const rawKind = typeof params.kind === "string" ? params.kind : "";
  if (!isHourlyOfferKind(rawKind)) redirect("/offers");
  const kind = rawKind as OfferKindKey & ("consulting" | "coaching");
  const kindMeta = OFFER_KINDS.find((item) => item.key === kind)!;

  const offerId = typeof params.offer === "string" ? params.offer.trim() : "";
  if (!offerId) redirect(`/offers/who?kind=${kind}`);

  const quote = await prisma.quote.findFirst({
    where: { id: offerId, brandId: brand.id, kind },
    select: {
      id: true,
      status: true,
      snapshotJson: true,
      publicToken: true,
      client: { select: { name: true, email: true, company: true } },
    },
  });
  if (!quote) redirect("/offers");

  const capabilities = await getSchemaCapabilities();
  if (capabilities.agreementTemplates) await ensureDefaultAgreementTemplate(brand.id);
  const [catalog, agreementTemplates] = await Promise.all([
    loadHourlyCatalog(brand.id, kind),
    capabilities.agreementTemplates
      ? prisma.agreementTemplate.findMany({
          where: { brandId: brand.id, status: "active" },
          orderBy: [{ defaultForProductKind: "desc" }, { isDefault: "desc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            description: true,
            content: true,
            isDefault: true,
            defaultForProductKind: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const snapshot = isRecord(quote.snapshotJson) ? quote.snapshotJson : {};
  const priorSelection = isRecord(snapshot.selection) ? snapshot.selection : null;
  const priorContactInfo = isRecord(snapshot.contactInfo) ? snapshot.contactInfo : null;
  const priorPrimary = isRecord(priorContactInfo?.primaryContact)
    ? (priorContactInfo!.primaryContact as Record<string, unknown>)
    : null;
  const priorAgreementTemplateId =
    typeof snapshot.agreementTemplateId === "string" ? (snapshot.agreementTemplateId as string) : null;

  // Prefer template flagged as default for this kind; then the brand default;
  // then the first active. The user can override.
  const defaultTemplate =
    agreementTemplates.find((t) => t.defaultForProductKind === kind) ??
    agreementTemplates.find((t) => t.isDefault) ??
    agreementTemplates[0] ??
    null;
  const chosenTemplateId = priorAgreementTemplateId ?? defaultTemplate?.id ?? null;
  const chosenTemplate = agreementTemplates.find((t) => t.id === chosenTemplateId) ?? defaultTemplate;

  const initial: HourlyOfferInitialState = {
    offerId: quote.id,
    kind,
    published: Boolean(quote.publicToken && quote.status !== "draft"),
    publicPath: quote.publicToken ? `/proposal/${quote.publicToken}` : null,
    contactInfo: {
      companyName:
        (typeof priorContactInfo?.companyName === "string" ? (priorContactInfo.companyName as string) : "") ||
        quote.client.company || "",
      invoicingEmail:
        (typeof priorContactInfo?.invoicingEmail === "string" ? (priorContactInfo.invoicingEmail as string) : "") ||
        quote.client.email || "",
      primaryContact: {
        firstName: typeof priorPrimary?.firstName === "string" ? (priorPrimary.firstName as string) : "",
        lastName: typeof priorPrimary?.lastName === "string" ? (priorPrimary.lastName as string) : "",
        email: typeof priorPrimary?.email === "string" ? (priorPrimary.email as string) : quote.client.email || "",
        phone: typeof priorPrimary?.phone === "string" ? (priorPrimary.phone as string) : "",
      },
    },
    selection: priorSelection
      ? {
          catalogItemId: typeof priorSelection.catalogItemId === "string" ? (priorSelection.catalogItemId as string) : "",
          catalogItemLabel: typeof priorSelection.catalogItemLabel === "string" ? (priorSelection.catalogItemLabel as string) : "",
          quantity: typeof priorSelection.quantity === "number" ? (priorSelection.quantity as number) : 1,
          unitPrice: typeof priorSelection.unitPrice === "number" ? (priorSelection.unitPrice as number) : 0,
          intakeFee: typeof priorSelection.intakeFee === "number" ? (priorSelection.intakeFee as number) : 0,
        }
      : null,
    agreementTemplateId: chosenTemplate?.id ?? null,
    agreementTemplateName: chosenTemplate?.name ?? null,
    agreementText: chosenTemplate?.content ?? null,
    isTestProposal:
      typeof snapshot.isTestProposal === "boolean" ? (snapshot.isTestProposal as boolean) : false,
    catalog,
    agreementTemplates: agreementTemplates.map((t) => ({
      id: t.id,
      name: t.name,
      content: t.content,
      isDefault: t.isDefault,
      defaultForProductKind: t.defaultForProductKind,
    })),
  };

  return (
    <div className="p-8">
      <Link href="/offers" className="text-xs text-slate-400 hover:underline">
        ← All offers
      </Link>
      <h1 className="mt-1 text-2xl font-semibold text-slate-900">{kindMeta.name}</h1>
      <p className="mt-1 text-sm text-slate-500">{kindMeta.summary}</p>
      <div className="mt-6">
        <HourlyOfferBuilder initial={initial} />
      </div>
    </div>
  );
}
