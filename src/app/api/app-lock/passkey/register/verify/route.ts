import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAppLockState } from "@/lib/app-lock/server";
import { verifyRegistration } from "@/lib/app-lock/passkeys";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!(await getAppLockState(session.user.id)).unlocked) {
    return NextResponse.json({ error: "Unlock with your PIN first." }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { response?: unknown; name?: unknown } | null;
  if (!body?.response) return NextResponse.json({ error: "Missing response." }, { status: 400 });
  const ok = await verifyRegistration(
    session.user.id,
    body.response as Parameters<typeof verifyRegistration>[1],
    typeof body.name === "string" ? body.name : "This device",
  );
  return ok ? NextResponse.json({ ok }) : NextResponse.json({ error: "Could not add this device." }, { status: 400 });
}
