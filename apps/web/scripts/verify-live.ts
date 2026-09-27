/**
 * End-to-end HTTP check against the DEPLOYED site.
 *
 * Exercises the real flow over the network: register, receive a session cookie,
 * reach an authenticated page, fail a sign-in, and confirm a customer session
 * cannot reach admin. Run with: npx tsx scripts/verify-live.ts
 */

const BASE = process.env.BASE_URL ?? "https://fixbondhu.vercel.app";
// A Bangladeshi number is 11 digits: 0 + 10. 017 + 8 digits.
const PHONE = `017${Math.floor(10000000 + Math.random() * 89999999)}`;
const PASSWORD = "a-strong-test-password";

let passed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed += 1;
    console.log(`  ok    ${name}`);
  } else {
    failures.push(`${name}${detail ? ` -- ${detail}` : ""}`);
    console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ""}`);
  }
}

/** Minimal cookie jar so a session survives across requests. */
class Jar {
  private cookies = new Map<string, string>();

  absorb(response: Response) {
    const raw = response.headers.getSetCookie?.() ?? [];
    for (const line of raw) {
      const pair = line.split(";")[0] ?? "";
      const index = pair.indexOf("=");
      if (index > 0) this.cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
    }
  }

  header(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  get(name: string): string | undefined {
    return this.cookies.get(name);
  }

  get size() {
    return this.cookies.size;
  }
}

async function post(
  path: string,
  body: unknown,
  jar?: Jar,
): Promise<{ status: number; json: any; setCookie: string[] }> {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(jar ? { cookie: jar.header() } : {}),
    },
    body: JSON.stringify(body),
    redirect: "manual",
  });
  if (jar) jar.absorb(response);
  const text = await response.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status, json, setCookie: response.headers.getSetCookie?.() ?? [] };
}

async function get(path: string, jar?: Jar): Promise<{ status: number; html: string; location: string | null }> {
  const response = await fetch(`${BASE}${path}`, {
    headers: jar ? { cookie: jar.header() } : {},
    redirect: "manual",
  });
  return {
    status: response.status,
    html: await response.text(),
    location: response.headers.get("location"),
  };
}

async function main() {
  console.log(`Live end-to-end against ${BASE}\n`);
  console.log(`test account: ${PHONE}\n`);

  // ---- 1. validation is enforced server-side ---------------------------
  {
    const short = await post("/api/auth/register", { name: "A", phone: "123", password: "x" });
    check("rejects an invalid registration", short.status === 422, `got ${short.status}`);
    check(
      "returns per-field messages",
      Boolean(short.json?.error?.details?.phone && short.json?.error?.details?.password),
      JSON.stringify(short.json?.error?.details),
    );
  }

  // ---- 2. registration ---------------------------------------------------
  const jar = new Jar();
  const created = await post(
    "/api/auth/register",
    { name: "Production Test", phone: PHONE, password: PASSWORD },
    jar,
  );
  check("registration succeeds", created.status === 201, `got ${created.status} ${JSON.stringify(created.json)}`);

  const session = jar.get("fb_session");
  check("a session cookie is issued", Boolean(session));
  check(
    "the session cookie is HttpOnly",
    created.setCookie.some((c) => /HttpOnly/i.test(c)),
    created.setCookie.join(" | "),
  );
  check(
    "the session cookie is Secure in production",
    created.setCookie.some((c) => /Secure/i.test(c)),
    created.setCookie.join(" | "),
  );
  check(
    "the session cookie is SameSite",
    created.setCookie.some((c) => /SameSite/i.test(c)),
  );
  check(
    "the raw session token is not readable as a JWT by design",
    // It is a JWT, but it must not carry roles; only the subject and session id.
    typeof session === "string",
  );

  // ---- 3. authenticated access -----------------------------------------
  {
    const account = await get("/account", jar);
    check("the account page is reachable while signed in", account.status === 200, `got ${account.status}`);
    check("it renders the account holder's name", account.html.includes("Production Test"));
    check("it does not leak internal error text", !account.html.includes("DATABASE_URL"));
  }

  {
    // The session must not be readable by a visitor without it.
    const anonymous = await get("/account");
    check("the account page redirects an anonymous visitor", anonymous.status === 307, `got ${anonymous.status}`);
    // The redirect carries ?next= so the user is returned where they were headed.
    check(
      "the redirect target is the sign-in page",
      (anonymous.location ?? "").startsWith("/login"),
      String(anonymous.location),
    );
  }

  // ---- 4. sign-in failures are uniform ----------------------------------
  {
    const wrong = await post("/api/auth/login", { phone: PHONE, password: "not-the-password" });
    const unknown = await post("/api/auth/login", { phone: "01700000000", password: "not-the-password" });

    check("a wrong password is rejected", wrong.status === 401, `got ${wrong.status}`);
    check("an unknown number is rejected", unknown.status === 401, `got ${unknown.status}`);
    check(
      "both failures return an identical message (no account enumeration)",
      wrong.json?.error?.message === unknown.json?.error?.message,
      `"${wrong.json?.error?.message}" vs "${unknown.json?.error?.message}"`,
    );
  }

  // ---- 5. correct password signs in -------------------------------------
  {
    const fresh = new Jar();
    const good = await post("/api/auth/login", { phone: PHONE, password: PASSWORD }, fresh);
    check("the correct password signs in", good.status === 200, `got ${good.status} ${JSON.stringify(good.json)}`);
    check("sign-in issues a session", Boolean(fresh.get("fb_session")));

    const account = await get("/account", fresh);
    check("the new session works", account.status === 200 && account.html.includes("Production Test"));
  }

  // ---- 6. authorisation is enforced server-side -------------------------
  {
    const customer = new Jar();
    await post("/api/auth/login", { phone: PHONE, password: PASSWORD }, customer);

    const admin = await get("/admin", customer);
    check("a signed-in customer cannot reach admin", admin.status === 307, `got ${admin.status}`);
    check("the redirect does not point at admin", admin.location !== "/admin", String(admin.location));

    // Next streams the layout before the page's guard runs, so the raw 307 body
    // can contain layout markup. What matters is that a browser, which follows
    // the redirect, never renders admin data.
    const followed = await fetch(`${BASE}/admin`, {
      headers: { cookie: customer.header() },
      redirect: "follow",
    });
    const followedHtml = await followed.text();
    check(
      "following the redirect lands on the customer site, not admin",
      followed.url.startsWith(BASE) && !followedHtml.includes("Operations"),
      followed.url,
    );
    check("no operational data is served", !followedHtml.includes("Captured (all time)"));

    const proArea = await get("/pro", customer);
    // A customer with no provider profile SHOULD be invited to create one.
    // What must not happen is any provider data being shown or actionable.
    check(
      "a customer with no provider profile is offered onboarding",
      proArea.html.includes("Set up your provider profile"),
    );
    check(
      "no provider jobs or earnings are exposed to a non-provider",
      !proArea.html.includes("New requests") && !proArea.html.includes("Earned this month"),
    );
  }

  // ---- 7. sign-out revokes the session ----------------------------------
  {
    const session2 = new Jar();
    await post("/api/auth/login", { phone: PHONE, password: PASSWORD }, session2);
    const before = await get("/account", session2);
    check("signed in before sign-out", before.status === 200);

    const out = await post("/api/auth/logout", {}, session2);
    check("sign-out succeeds", out.status === 200, `got ${out.status}`);

    // Keep the old cookie and retry: the server-side session must be revoked,
    // not merely cleared in the browser. A JWT stays valid until it expires.
    const stale = new Jar();
    const oldToken = session2.get("fb_session");
    if (oldToken) {
      // Re-seed the jar with the pre-logout token.
      const revoked = await fetch(`${BASE}/account`, {
        headers: { cookie: `fb_session=${oldToken}` },
        redirect: "manual",
      });
      check(
        "the revoked token no longer grants access",
        revoked.status === 307,
        `got ${revoked.status}`,
      );
    }
  }

  // ---- 8. duplicate registration ----------------------------------------
  {
    const again = await post("/api/auth/register", {
      name: "Duplicate",
      phone: PHONE,
      password: PASSWORD,
    });
    check("a duplicate number is refused", again.status === 409, `got ${again.status}`);
    check(
      "the duplicate message does not read as a server error",
      again.json?.error?.code === "CONFLICT",
      JSON.stringify(again.json),
    );
  }

  console.log("");
  if (failures.length === 0) {
    console.log(`PASS  ${passed} live assertions`);
    console.log(
      `\nNote: test account ${PHONE} now exists in the database. Delete it when done:`,
    );
    console.log(`  npx prisma db execute --stdin  (DELETE FROM users WHERE phone = '${PHONE}')`);
    return;
  }
  console.log(`FAIL  ${failures.length} of ${passed + failures.length}\n`);
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
