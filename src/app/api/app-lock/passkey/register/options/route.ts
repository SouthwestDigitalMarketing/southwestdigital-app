import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAppLockState } from "@/lib/app-lock/server";
import { registrationOptions } from "@/lib/app-lock/passkeys";

/** Start adding Face ID / fingerprint on this device. Needs an unlocked session. */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!(await getAppLockState(session.user.id)).unlocked) {
    return NextResponse.json({ error: "Unlock with your PIN first." }, { status: 403 });
  }
  return NextResponse.json(await registrationOptions({ id: session.user.id, email: session.user.email }));
}
