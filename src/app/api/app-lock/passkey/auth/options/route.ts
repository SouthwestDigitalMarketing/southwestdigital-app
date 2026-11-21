import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { authenticationOptions } from "@/lib/app-lock/passkeys";

/** Start a Face ID / fingerprint unlock. Needs a signed-in (but locked) session. */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const options = await authenticationOptions(session.user.id);
  if (!options) return NextResponse.json({ error: "No Face ID / fingerprint on this site yet." }, { status: 404 });
  return NextResponse.json(options);
}
