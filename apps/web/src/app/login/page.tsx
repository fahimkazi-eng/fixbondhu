import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in to FixBondhu",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <main id="main" className="container-page flex min-h-dvh items-center py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold tracking-tight text-ink-900">
          Sign in
        </h1>
        <p className="mt-1 text-sm text-ink-600">
          Use the mobile number you registered with.
        </p>

        <form className="card mt-6 space-y-4 p-5" method="post" action="/api/auth/otp">
          <div>
            <label className="label" htmlFor="phone">
              Mobile number
            </label>
            <input
              className="input"
              id="phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="01712 345678"
              aria-describedby="phone-hint"
            />
            <p id="phone-hint" className="mt-1.5 text-xs text-ink-500">
              Bangladeshi numbers only. We send a one-time code.
            </p>
          </div>

          <button className="btn btn-primary w-full" type="submit">
            Send code
          </button>
        </form>
      </div>
    </main>
  );
}
