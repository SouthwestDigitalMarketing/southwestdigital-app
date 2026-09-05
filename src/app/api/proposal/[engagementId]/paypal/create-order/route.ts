import { hasPublicProposalAccess, publicProposalNotFound } from "@/lib/engagements/publicProposalAccess";

// Legacy global merchant credentials cannot route funds safely for a SaaS
// tenant. Keep a controlled response for older open browser tabs.
export async function POST(request: Request, { params }: { params: Promise<{ engagementId: string }> }) {
  const { engagementId } = await params;
  if (!await hasPublicProposalAccess(request, engagementId)) return publicProposalNotFound();
  return Response.json({ error: "PayPal is currently unavailable. Reload the proposal to pay securely by card." }, { status: 409 });
}
