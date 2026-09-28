import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";


import { getUser } from "@/lib/auth";
import { AuthForm } from "@/components/auth-form";
import { GoogleSignInButton } from "@/components/google-sign-in-button";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getUser()) {
    redirect("/account");
  }

  // Read on the server so the value is inlined at build/render time. If it is
  // absent the Google option is not offered at all, rather than rendering a
  // button that cannot work.
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const googleEnabled = Boolean(googleClientId && process.env.GOOGLE_CLIENT_ID);

  return (
    <main id="main" className="container-page flex min-h-dvh flex-col py-8">
      <Link href="/" className="flex items-center gap-2 self-start">
        <BrandMark className="h-7 w-7" />
        <span className="text-[15px] font-semibold tracking-tight">FixBondhu</span>
      </Link>

      <div className="w-full max-w-sm sm:mx-auto">
        <div className="mt-10">
          <h1 className="text-xl font-semibold tracking-tight text-ink-900">Sign in</h1>
          <p className="mt-1 text-sm text-ink-600">
            Sign in with the mobile number you registered, or continue with Google.
          </p>
        </div>

        {googleEnabled && googleClientId ? (
          <div className="mt-5">
            <GoogleSignInButton clientId={googleClientId} intent="signin" />
          </div>
        ) : null}

        <AuthForm
          action="/api/auth/login"
          submitLabel="Sign in with mobile"
          createAccountHref="/register"
          fields={[
            {
              name: "phone",
              label: "Mobile number",
              type: "tel",
              autoComplete: "tel",
              placeholder: "01712 345678",
              hint: "Bangladeshi numbers only.",
            },
            {
              name: "password",
              label: "Password",
              type: "password",
              autoComplete: "current-password",
            },
          ]}
        />
      </div>
    </main>
  );
}
