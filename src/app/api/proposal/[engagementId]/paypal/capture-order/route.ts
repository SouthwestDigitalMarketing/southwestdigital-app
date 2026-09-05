import { hasPublicProposalAccess, publicProposalNotFound } from "@/lib/engagements/publicProposalAccess";

// Do not capture orders created under the retired shared-merchant flow.
export async function POST(request: Request, { params }: { params: Promise<{ engagementId: string }> }) {
  const { engagementId } = await params;
  if (!await hasPublicProposalAccess(request, engagementId)) return publicProposalNotFound();
  return Response.json({ error: "This PayPal checkout cannot be completed. Contact your bookkeeper to review the order before trying another payment." }, { status: 409 });
}
