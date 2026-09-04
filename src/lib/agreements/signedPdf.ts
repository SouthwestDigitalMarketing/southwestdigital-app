import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

type SignedProposalPdfInput = {
  brandName: string;
  offerCode: string;
  clientName: string;
  tierLabel: string;
  recurringMonthlyTotal: number;
  oneTimeTotal: number;
  amountPaid: number | null;
  currency: string;
  agreementText: string;
  agreementTextHash: string;
  signerName: string;
  signerTitle: string | null;
  signerEmail: string | null;
  signedAt: Date;
  signerIpAddress: string | null;
  signerUserAgent: string | null;
  paymentProvider: string | null;
  paymentReference: string | null;
  paidAt: Date | null;
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 54;

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  const safeText = text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/•/g, "*")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?");
  for (const paragraph of safeText.replace(/\r/g, "").split("\n")) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    const words = paragraph.split(/\s+/);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function addFooter(page: PDFPage, font: PDFFont, pageNumber: number) {
  page.drawText(`Signed proposal · ${pageNumber}`, {
    x: MARGIN,
    y: 26,
    size: 8,
    font,
    color: rgb(0.38, 0.43, 0.5),
  });
}

export async function createSignedProposalPdf(input: SignedProposalPdfInput) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let pageNumber = 1;
  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const newPage = () => {
    addFooter(page, regular, pageNumber);
    pageNumber += 1;
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  };
  const line = (text: string, options?: { bold?: boolean; size?: number; gap?: number; color?: ReturnType<typeof rgb> }) => {
    const font = options?.bold ? bold : regular;
    const size = options?.size ?? 10;
    const height = size * 1.38;
    for (const wrapped of wrapText(text, font, size, PAGE_WIDTH - MARGIN * 2)) {
      if (y < 48) newPage();
      if (wrapped) page.drawText(wrapped, { x: MARGIN, y, size, font, color: options?.color ?? rgb(0.08, 0.12, 0.18) });
      y -= height;
    }
    y -= options?.gap ?? 3;
  };

  line("SIGNED PROPOSAL & AGREEMENT", { bold: true, size: 18, gap: 10 });
  line(input.brandName, { bold: true, size: 12 });
  line(`Prepared for: ${input.clientName}`);
  line(`Offer ID: ${input.offerCode}`);
  line(`Selected package: ${input.tierLabel}`);
  line(`Ongoing services: ${input.currency} ${input.recurringMonthlyTotal.toFixed(2)} per month`);
  line(`One-time services: ${input.currency} ${input.oneTimeTotal.toFixed(2)}`);
  line(input.amountPaid === null ? "Payment: Not yet confirmed" : `Payment confirmed: ${input.currency} ${input.amountPaid.toFixed(2)}`, { gap: 14 });
  line("AGREEMENT", { bold: true, size: 14, gap: 8 });
  line(input.agreementText, { size: 9, gap: 12 });

  if (y < 300) newPage();
  line("ELECTRONIC SIGNATURE CERTIFICATE", { bold: true, size: 14, gap: 8 });
  line(`Signed by: ${input.signerName}${input.signerTitle ? `, ${input.signerTitle}` : ""}`);
  line(`Signer email: ${input.signerEmail ?? "Not recorded"}`);
  line(`Signed at: ${input.signedAt.toISOString()}`);
  line(`IP address: ${input.signerIpAddress ?? "Not recorded"}`);
  line(`User agent: ${input.signerUserAgent ?? "Not recorded"}`);
  line("Consent: Electronic signature accepted; agreement reviewed and affirmed; scroll-to-end requirement completed.");
  line(`Agreement SHA-256: ${input.agreementTextHash}`, { size: 8 });
  if (input.paymentReference) {
    line(`Payment provider: ${input.paymentProvider ?? "Recorded provider"}`);
    line(`Payment reference: ${input.paymentReference}`);
    line(`Payment confirmed at: ${input.paidAt?.toISOString() ?? "Recorded without timestamp"}`);
  }
  line("This certificate records the electronic-signature evidence captured by the proposal system. Keep this file with the signed agreement.", {
    size: 9,
    color: rgb(0.38, 0.43, 0.5),
  });

  addFooter(page, regular, pageNumber);
  return pdf.save();
}
