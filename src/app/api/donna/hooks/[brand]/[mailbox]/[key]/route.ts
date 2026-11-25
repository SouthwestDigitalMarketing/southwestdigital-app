import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  createBrandDataContext,
  withBrandDataTransaction,
} from "@/lib/tenancy/context";
import { encryptSecret, decryptSecret } from "@/lib/secrets/encryption";
import { verifyHook } from "@/lib/donna/domain";
import { enqueue } from "@/lib/donna/store";
import { checkRateLimit } from "@/lib/simpleRateLimit";
import { readBoundedBody } from "@/lib/donna/http";

export const dynamic = "force-dynamic";
export async function POST(
  request: Request,
  {
    params,
  }: { params: Promise<{ brand: string; mailbox: string; key: string }> },
) {
  const p = await params;
  if (
    !/^[a-f0-9]{64}$/.test(p.key) ||
    !checkRateLimit(`donna-hook:${p.mailbox}`, 300, 60_000).allowed
  )
    return NextResponse.json({ error: "Unavailable." }, { status: 429 });
  const raw = await readBoundedBody(request, 256_000);
  if (!raw)
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  const brand = await prisma.brand.findUnique({
    where: { slug: p.brand },
    select: { id: true, status: true, deletedAt: true },
  });
  if (!brand || brand.status !== "ACTIVE" || brand.deletedAt)
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  const context = createBrandDataContext({
    brandId: brand.id,
    actorUserId: "donna-hook",
  });
  return withBrandDataTransaction(context, async (tx) => {
    // Enrollment is allowed only via an operator-created random URL, for ten minutes.
    await tx.$queryRaw`SELECT id FROM "DonnaMailbox" WHERE id=${p.mailbox} AND "brandId"=${brand.id} FOR UPDATE`;
    const box = await tx.donnaMailbox.findFirst({
      where: { id: p.mailbox, brandId: brand.id, hookKey: p.key },
    });
    if (!box)
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    const enrollment =
      !box.hookSecret && box.setupExpiresAt && box.setupExpiresAt > new Date();
    const supplied = request.headers.get("x-hook-secret");
    const secret = box.hookSecret
      ? decryptSecret(box.hookSecret)
      : enrollment
        ? supplied
        : null;
    if (
      !secret ||
      secret.length > 1000 ||
      !verifyHook(raw, request.headers.get("x-hook-signature"), secret)
    )
      return NextResponse.json(
        { error: "Invalid signature or setup expired." },
        { status: 401 },
      );
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(raw.toString("utf8"));
    } catch {
      return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload))
      return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
    // Store no email bodies from a public hook. The worker reads authenticated IMAP.
    const exactId =
      raw.toString("utf8").match(/"messageId"\s*:\s*(\d+)/)?.[1] ??
      payload.messageId ??
      null;
    const eventKey = `hook:${createHash("sha256")
      .update(
        JSON.stringify([
          exactId,
          payload.receivedTime ?? null,
          payload.IntegIdList ?? null,
          payload.messageId ? null : raw.toString("utf8"),
        ]),
      )
      .digest("hex")}`;
    if (enrollment)
      await tx.donnaMailbox.update({
        where: { id: box.id },
        data: { hookSecret: encryptSecret(secret), setupExpiresAt: null },
      });
    await enqueue(tx, box.id, "incoming", eventKey);
    await tx.donnaMailbox.update({
      where: { id: box.id },
      data: { lastNotifiedAt: new Date() },
    });
    return NextResponse.json({ accepted: true });
  });
}
