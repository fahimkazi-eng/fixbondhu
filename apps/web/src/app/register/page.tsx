import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getUser } from "@/lib/auth";
import { AuthForm } from "@/components/auth-form";
import { GoogleSignInButton } from "@/components/google-sign-in-button";

export const metadata: Metadata = {
  title: "Create your account",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await getUser()) {
    redirect("/account");
  }

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const googleEnabled = Boolean(googleClientId && process.env.GOOGLE_CLIENT_ID);

  return (
    <main id="main" className="container-page flex min-h-dvh flex-col py-8">
      <Link href="/" className="flex items-center gap-2 self-start">
        <span
          aria-hidden
          className="grid h-7 w-7 place-items-center rounded-md bg-brand-700 text-sm font-bold text-white"
        >
          F
        </span>
        <span className="text-[15px] font-semibold tracking-tight">FixBondhu</span>
      </Link>

      <div className="w-full max-w-sm sm:mx-auto">
        <div className="mt-10">
          <h1 className="text-xl font-semibold tracking-tight text-ink-900">
            Create your account
          </h1>
          <p className="mt-1 text-sm text-ink-600">
            Sign up with Google, or use your mobile number.
          </p>
        </div>

        {googleEnabled && googleClientId ? (
          <div className="mt-5">
            <GoogleSignInButton clientId={googleClientId} intent="signup" />
          </div>
        ) : null}

        <AuthForm
          action="/api/auth/register"
          submitLabel="Create account with mobile"
          fields={[
            {
              name: "name",
              label: "Full name",
              type: "text",
              autoComplete: "name",
              placeholder: "Your name",
            },
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
              autoComplete: "new-password",
              hint: "At least 8 characters.",
            },
          ]}
          footer={
            <p className="text-center text-sm text-ink-600">
              Already registered?{" "}
              <a href="/login" className="font-medium text-brand-700 underline">
                Sign in
              </a>
            </p>
          }
        />
      </div>
    </main>
  );
}
