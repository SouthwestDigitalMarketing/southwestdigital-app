import "server-only";

import { cookies } from "next/headers";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
} from "@simplewebauthn/types";
import { prisma } from "@/lib/prisma";
import { appLockSecret, relyingParty, setUnlockCookie } from "./server";
import { CHALLENGE_COOKIE, CHALLENGE_MINUTES, readValue, signValue } from "./token";

type Purpose = "register" | "auth";

async function storeChallenge(purpose: Purpose, userId: string, challenge: string) {
  (await cookies()).set(
    CHALLENGE_COOKIE,
    signValue([purpose, userId, challenge], Date.now() + CHALLENGE_MINUTES * 60_000, appLockSecret()),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/app-lock",
      maxAge: CHALLENGE_MINUTES * 60,
    },
  );
}

/** The challenge issued to this user for this purpose; consumed on read. */
async function takeChallenge(purpose: Purpose, userId: string): Promise<string | null> {
  const jar = await cookies();
  const parts = readValue(jar.get(CHALLENGE_COOKIE)?.value, Date.now(), appLockSecret());
  jar.delete({ name: CHALLENGE_COOKIE, path: "/api/app-lock" });
  if (!parts || parts[0] !== purpose || parts[1] !== userId) return null;
  return parts[2] ?? null;
}

function transportsOf(values: string[]): AuthenticatorTransportFuture[] {
  return values as AuthenticatorTransportFuture[];
}

export async function registrationOptions(user: { id: string; email: string }) {
  const { rpId } = await relyingParty();
  const existing = await prisma.userPasskey.findMany({ where: { userId: user.id, rpId } });
  const options = await generateRegistrationOptions({
    rpName: "SWapp",
    rpID: rpId,
    userID: user.id,
    userName: user.email,
    attestationType: "none",
    excludeCredentials: existing.map((p) => ({
      id: isoBase64URL.toBuffer(p.credentialId),
      type: "public-key" as const,
      transports: transportsOf(p.transports),
    })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
  });
  await storeChallenge("register", user.id, options.challenge);
  return options;
}

export async function verifyRegistration(userId: string, response: RegistrationResponseJSON, name: string) {
  const expectedChallenge = await takeChallenge("register", userId);
  if (!expectedChallenge) return false;
  const { rpId, origin } = await relyingParty();
  const result = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpId,
    requireUserVerification: true,
  }).catch(() => null);
  if (!result?.verified || !result.registrationInfo) return false;
  const { credentialID, credentialPublicKey, counter } = result.registrationInfo;
  await prisma.userPasskey.create({
    data: {
      userId,
      credentialId: isoBase64URL.fromBuffer(credentialID),
      publicKey: Buffer.from(credentialPublicKey),
      counter: BigInt(counter),
      transports: response.response.transports ?? [],
      rpId,
      name: name.slice(0, 80) || "This device",
    },
  });
  return true;
}

export async function authenticationOptions(userId: string) {
  const { rpId } = await relyingParty();
  const passkeys = await prisma.userPasskey.findMany({ where: { userId, rpId } });
  if (passkeys.length === 0) return null;
  const options = await generateAuthenticationOptions({
    rpID: rpId,
    userVerification: "required",
    allowCredentials: passkeys.map((p) => ({
      id: isoBase64URL.toBuffer(p.credentialId),
      type: "public-key" as const,
      transports: transportsOf(p.transports),
    })),
  });
  await storeChallenge("auth", userId, options.challenge);
  return options;
}

/** Verifies a Face ID / fingerprint answer and unlocks this device. */
export async function verifyAuthentication(userId: string, response: AuthenticationResponseJSON) {
  const expectedChallenge = await takeChallenge("auth", userId);
  if (!expectedChallenge) return false;
  const { rpId, origin } = await relyingParty();
  const passkey = await prisma.userPasskey.findFirst({ where: { userId, rpId, credentialId: response.id } });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { pinChangedAt: true } });
  if (!passkey || !user?.pinChangedAt) return false;
  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpId,
    requireUserVerification: true,
    authenticator: {
      credentialID: isoBase64URL.toBuffer(passkey.credentialId),
      credentialPublicKey: new Uint8Array(passkey.publicKey),
      counter: Number(passkey.counter),
      transports: transportsOf(passkey.transports),
    },
  }).catch(() => null);
  if (!result?.verified) return false;
  await prisma.userPasskey.update({
    where: { id: passkey.id },
    data: { counter: BigInt(result.authenticationInfo.newCounter), lastUsedAt: new Date() },
  });
  await setUnlockCookie(userId, user.pinChangedAt);
  return true;
}
