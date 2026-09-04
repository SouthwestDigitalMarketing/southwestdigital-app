import { notFound } from "next/navigation";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { AcknowledgmentForm } from "./AcknowledgmentForm";

export default async function AgreementCancellationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const agreement = await prisma.engagement.findFirst({ where: { agreementCancellationTokenHash: tokenHash }, select: { clientName: true, signerName: true, agreementCancellationReason: true, agreementCancellationTokenExpiresAt: true, agreementManagerStatus: true } });
  if (!agreement || agreement.agreementCancellationTokenExpiresAt && agreement.agreementCancellationTokenExpiresAt < new Date()) notFound();
  return <main className="min-h-screen bg-slate-50 px-4 py-12"><div className="mx-auto max-w-xl"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Agreement cancellation</p><h1 className="mt-2 text-2xl font-semibold text-slate-900">Review cancellation request</h1><p className="mt-3 text-sm leading-6 text-slate-600">A cancellation request has been made for the signed agreement for <strong>{agreement.clientName}</strong>. Confirm below if you acknowledge the request.</p>{agreement.agreementCancellationReason ? <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-700"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Reason</p><p className="mt-1">{agreement.agreementCancellationReason}</p></div> : null}<div className="mt-5"><AcknowledgmentForm token={token} /></div></div></main>;
}
