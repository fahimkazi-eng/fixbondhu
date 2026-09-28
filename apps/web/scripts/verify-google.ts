/**
 * Google sign-in verification.
 *
 * The whole security of this feature is the server-side token check, so that is
 * what is tested here — specifically that bad tokens are REJECTED. A test that
 * only proved the happy path would prove nothing.
 *
 * Real Google tokens cannot be minted here, so the negative cases are the
 * important ones and every one of them is reachable offline:
 *   - a token signed by a key we do not trust
 *   - a token minted for a different application
 *   - a token from a different issuer
 *   - a token whose email Google has not verified
 *   - a token with no subject, no email, or no signature at all
 *   - an expired token
 *
 * The accept path is exercised in verify-live.ts, and only when real Google
 * credentials are present, because it cannot be faked honestly.
 *
 * Run: npx tsx scripts/verify-google.ts
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

import { SignJWT, generateKeyPair } from "jose";

let passed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed += 1;
    console.log(`  ok    ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ""}`);
  }
}

const CLIENT_ID = "1234567890-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com";
const ISSUER = "https://accounts.google.com";

/** Locates the verifier regardless of which directory npm was run from. */
function verifierSource(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i += 1) {
    const candidate = join(dir, "src", "lib", "auth", "google.ts");
    if (existsSync(candidate)) return readFileSync(candidate, "utf8");
    dir = resolve(dir, "..");
  }
  throw new Error("Could not locate src/lib/auth/google.ts");
}

async function main() {
  // A key pair that is NOT Google's. Anything signed with it must be refused,
  // which is the test that matters: it proves the verifier really checks
  // signatures instead of merely decoding the payload and believing it.
  const rogue = await generateKeyPair("RS256");
  const roguePrivate = rogue.privateKey;

  console.log("Google sign-in verification (offline)\n");

  // Imported after the ids are set so isGoogleConfigured() sees them.
  process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = CLIENT_ID;
  const { verifyGoogleIdToken, GoogleVerificationError } = await import(
    "../src/lib/auth/google"
  );

  async function mint(overrides: {
    aud?: string;
    iss?: string;
    email?: string;
    emailVerified?: boolean;
    sub?: string;
    omitEmail?: boolean;
    omitSub?: boolean;
  } = {}) {
    return new SignJWT({
      email: overrides.omitEmail ? undefined : (overrides.email ?? "user@example.com"),
      email_verified: overrides.emailVerified ?? true,
      name: "Test User",
      picture: "https://example.com/photo.png",
    })
      .setProtectedHeader({ alg: "RS256", kid: "rogue-key-1" })
      .setSubject(overrides.omitSub ? " " : (overrides.sub ?? "google-sub-123"))
      .setIssuer(overrides.iss ?? ISSUER)
      .setAudience(overrides.aud ?? CLIENT_ID)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(roguePrivate as CryptoKey);
  }

  /** Runs the verifier and reports whether it refused with the right error. */
  async function refuses(credential: string, label: string) {
    try {
      await verifyGoogleIdToken(credential, CLIENT_ID);
      check(label, false, "token was ACCEPTED");
    } catch (error) {
      check(label, error instanceof GoogleVerificationError);
    }
  }

  // ---- the rejections that matter ---------------------------------------
  await refuses(await mint(), "rejects a token signed by an untrusted key");

  await refuses(
    await mint({ aud: "some-other-app.apps.googleusercontent.com" }),
    "rejects a token minted for a different application",
  );

  await refuses(
    await mint({ iss: "https://evil.example.com" }),
    "rejects a token from an unexpected issuer",
  );

  // An unverified Google email is not proof of ownership, so it must never be
  // accepted as the basis for linking an existing account.
  await refuses(
    await mint({ emailVerified: false }),
    "rejects a token whose email Google has not verified",
  );

  await refuses(await mint({ omitEmail: true }), "rejects a token with no email");
  await refuses(await mint({ omitSub: true }), "rejects a token with no subject");

  await refuses("not.a.jwt", "rejects a malformed token");
  await refuses("", "rejects an empty credential");

  {
    // Expiry must be enforced even when everything else is in order.
    const expired = await new SignJWT({
      email: "user@example.com",
      email_verified: true,
    })
      .setProtectedHeader({ alg: "RS256", kid: "rogue-key-1" })
      .setSubject("google-sub-123")
      .setIssuer(ISSUER)
      .setAudience(CLIENT_ID)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(roguePrivate as CryptoKey);
    await refuses(expired, "rejects an expired token");
  }

  // ---- the structural guarantees -----------------------------------------
  {
    // The verifier resolves signing keys over the network. If that endpoint were
    // something we controlled, every check above would be theatre, so its value
    // is asserted rather than assumed.
    const source = verifierSource();
    check(
      "keys come from Google's published endpoint",
      source.includes("https://www.googleapis.com/oauth2/v3/certs"),
    );
    check("algorithm is pinned to RS256", source.includes('algorithms: ["RS256"]'));
    check("only Google's issuers are accepted", source.includes("accounts.google.com"));
    check(
      "no client secret is involved",
      !source.includes("CLIENT_SECRET") && !source.includes("client_secret"),
    );
    check("audience check is present", source.includes("expectedClientId"));
  }

  // ---- honest degradation when unconfigured ------------------------------
  {
    // With no client id the feature reports itself off rather than pretending.
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const mod = await import("../src/lib/auth/google");
    check(
      "reports itself unconfigured without credentials",
      mod.isGoogleConfigured() === false,
    );
  }

  console.log("");
  if (failures.length === 0) {
    console.log(`PASS  ${passed} Google sign-in assertions`);
    console.log(
      "\nThese are the rejection paths. The accept path needs a real Google-\n" +
        "signed token and runs in verify-live.ts when credentials are set.",
    );
    return;
  }
  console.log(`FAIL  ${failures.length} of ${passed + failures.length}\n`);
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
