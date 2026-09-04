import "server-only";

import { prisma } from "@/lib/prisma";

export async function hasPublicProposalAccess(request: Request, engagementId: string) {
  const token = request.headers.get("x-proposal-token")?.trim();
  if (!token) return false;
  const quote = await prisma.quote.findFirst({
    where: {
      engagementId,
      publicToken: token,
      publishedAt: { not: null },
    },
    select: { id: true },
  });
  return Boolean(quote);
}

export function publicProposalNotFound() {
  return Response.json({ error: "Proposal not found" }, { status: 404 });
}
