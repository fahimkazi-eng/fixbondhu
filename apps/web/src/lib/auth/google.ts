/**
 * Google sign-in.
 *
 * The browser hands back a Google ID token. Nothing about it is trusted: it is
 * verified here, on the server, against Google's published public keys, and the
 * audience is checked against our own client id. A token that fails any check is
 * discarded.
 *
 * A JWT that merely *looks* right is a common and serious mistake. The claims
 * are only meaningful once the signature has been verified against a key Google
 * actually publishes, which is what createRemoteJWKSet does.
 */

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const GOOGLE_JWKS_URL = new URL("https://www.googleapis.com/oauth2/v3/certs");

// Google's signing keys are cached and refetched only when an unknown `kid`
// appears, so a normal sign-in makes no outbound call.
const jwks = createRemoteJWKSet(GOOGLE_JWKS_URL);

export interface GoogleIdentity {
  /** Google's stable account id. */
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string | null;
}

export class GoogleVerificationError extends Error {}

/**
 * Verifies a Google ID token and returns the claims we rely on.
 *
 * `expectedClientId` is the audience check. Without it a token minted for some
 * other application would be accepted here, which is the whole attack.
 */
export async function verifyGoogleIdToken(
  credential: string,
  expectedClientId: string,
): Promise<GoogleIdentity> {
  let payload: JWTPayload;

  try {
    const result = await jwtVerify(credential, jwks, {
      audience: expectedClientId,
      algorithms: ["RS256"],
    });
    payload = result.payload;
  } catch (error) {
    throw new GoogleVerificationError(
      `Google token rejected: ${error instanceof Error ? error.message : "unknown"}`,
    );
  }

  // Issuer is checked explicitly. The library verifies the signature and the
  // audience; the issuer and the email guarantee are ours to enforce.
  if (!GOOGLE_ISSUERS.includes(payload.iss ?? "")) {
    throw new GoogleVerificationError("Google token has an unexpected issuer.");
  }
  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new GoogleVerificationError("Google token has no subject.");
  }
  if (typeof payload.email !== "string" || !payload.email.includes("@")) {
    throw new GoogleVerificationError("Google token has no email address.");
  }

  // An unverified Google email is not proof of ownership, so it is not used for
  // account linking.
  if (payload.email_verified !== true) {
    throw new GoogleVerificationError("Google email is not verified.");
  }

  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: true,
    name: typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : "FixBondhu customer",
    picture: typeof payload.picture === "string" ? payload.picture : null,
  };
}

export function isGoogleConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID,
  );
}
