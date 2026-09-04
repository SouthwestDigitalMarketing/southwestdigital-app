import { NextResponse } from "next/server";
import { EmailConnectionProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { decryptSecret } from "@/lib/secrets/encryption";
import { parseZohoRegion } from "@/lib/emailConnections/providers";
import { revokeZohoRefreshToken } from "@/lib/emailConnections/zohoMail";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await requireStaffBrandOrThrow();
  if (!ctx.membership) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  const connection = await prisma.emailConnection.findFirst({
    where: { id, brandId: ctx.brand.id, membershipId: ctx.membership.id },
  });
  if (!connection) return NextResponse.json({ error: "Connection not found." }, { status: 404 });

  if (connection.provider === EmailConnectionProvider.ZOHO) {
    const region = parseZohoRegion(connection.region);
    if (region) {
      try {
        const refreshToken = decryptSecret(connection.refreshTokenCiphertext);
        await revokeZohoRefreshToken({ region, refreshToken });
      } catch (error) {
        console.warn("[email-connections/delete] Revoke best-effort failed:", error);
      }
    }
  }

  await prisma.emailConnection.delete({ where: { id: connection.id } });
  return NextResponse.json({ ok: true });
}
