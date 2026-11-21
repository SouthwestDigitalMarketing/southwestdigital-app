import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { verifyAuthentication } from "@/lib/app-lock/passkeys";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const response = await request.json().catch(() => null);
  if (!response?.id) return NextResponse.json({ error: "Missing response." }, { status: 400 });
  const ok = await verifyAuthentication(session.user.id, response);
  return ok ? NextResponse.json({ ok }) : NextResponse.json({ error: "Did not match." }, { status: 401 });
}
