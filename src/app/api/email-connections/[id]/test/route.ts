import { NextResponse } from "next/server";
import { EmailConnectionProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { getFreshAccessToken, markEmailConnectionError } from "@/lib/emailConnections/repository";
import { parseZohoRegion } from "@/lib/emailConnections/providers";
import { sendZohoMailMessage, ZohoApiError } from "@/lib/emailConnections/zohoMail";

function trim(value: FormDataEntryValue | string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await requireStaffBrandOrThrow();
  if (!ctx.membership) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  const contentType = request.headers.get("content-type") ?? "";
  let toAddress = "";
  let subject = "";
  let body = "";
  if (contentType.includes("application/json")) {
    const json = (await request.json().catch(() => ({}))) as Partial<{ to: string; subject: string; body: string }>;
    toAddress = trim(json.to);
    subject = trim(json.subject);
    body = trim(json.body);
  } else {
    const form = await request.formData().catch(() => null);
    toAddress = trim(form?.get("to"));
    subject = trim(form?.get("subject"));
    body = trim(form?.get("body"));
  }

  if (!toAddress || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(toAddress)) {
    return NextResponse.json({ error: "Enter a valid recipient email." }, { status: 400 });
  }
  if (!subject) subject = "Test email from your app";
  if (!body) body = "This is a test message sent from your connected mailbox.";

  const connection = await prisma.emailConnection.findFirst({
    where: { id, brandId: ctx.brand.id, membershipId: ctx.membership.id },
  });
  if (!connection) return NextResponse.json({ error: "Connection not found." }, { status: 404 });
  if (connection.provider !== EmailConnectionProvider.ZOHO) {
    return NextResponse.json({ error: "This provider isn't available for sending yet." }, { status: 400 });
  }
  if (!connection.accountIdentifier) {
    return NextResponse.json({ error: "Reconnect Zoho — the account identifier is missing." }, { status: 409 });
  }
  const region = parseZohoRegion(connection.region);
  if (!region) return NextResponse.json({ error: "Reconnect Zoho — the region is invalid." }, { status: 409 });

  try {
    const accessToken = await getFreshAccessToken(connection);
    await sendZohoMailMessage({
      region,
      accessToken,
      accountId: connection.accountIdentifier,
      fromAddress: connection.emailAddress,
      toAddress,
      subject,
      bodyText: body,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[email-connections/test] Failed:", error);
    const message = error instanceof ZohoApiError
      ? `Zoho rejected the send: ${error.body.slice(0, 200)}`
      : error instanceof Error
        ? error.message
        : "Unknown error";
    await markEmailConnectionError(connection.id, message).catch(() => undefined);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
