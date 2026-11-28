import { prisma } from "@/lib/prisma";
import { requireQuoteStaffOrThrow } from "@/lib/quotes/access";
import { decodeAcceptedCopyHtml, readAcceptedCopy } from "@/lib/quotes/acceptedCopy";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { brand } = await requireQuoteStaffOrThrow();
  const { id } = await params;
  const quote = await prisma.quote.findFirst({
    where: { id, brandId: brand.id },
    select: { engagement: { select: { brandId: true, onboardingData: true } } },
  });
  const copy = quote?.engagement?.brandId === brand.id ? readAcceptedCopy(quote.engagement.onboardingData) : null;
  if (!copy || copy.quoteId !== id) return new Response("Saved copy not found.", { status: 404 });
  let html: string;
  try {
    html = decodeAcceptedCopyHtml(copy);
  } catch {
    return new Response("Saved copy not found.", { status: 404 });
  }
  return new Response(html, { headers: {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Disposition": `${new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline"}; filename="accepted-proposal.html"`,
    "Cache-Control": "private, no-store",
    "Content-Security-Policy": "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  } });
}
