import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";


import { requireUser } from "@/lib/auth";
import { CompleteProfileForm } from "@/components/complete-profile-form";

export const metadata: Metadata = {
  title: "Add your mobile number",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Post-Google onboarding.
 *
 * Google supplies a name, an email and a photo, but not a phone number. Without
 * one a provider cannot be contacted, so an account without it is sent here
 * before it can book. Redirected away the moment a number exists, so this is a
 * step rather than somewhere to linger.
 *
 * The form itself is a client component; this file only owns the redirect.
 */
export default async function CompleteProfilePage() {
  const user = await requireUser("/account/complete");

  if (user.phone) {
    redirect("/account");
  }

  return (
    <main id="main" className="container-page flex min-h-dvh flex-col py-8">
      <Link href="/" className="flex items-center gap-2 self-start">
        <BrandMark className="h-7 w-7" />
        <span className="text-[15px] font-semibold tracking-tight">FixBondhu</span>
      </Link>

      <div className="w-full max-w-sm sm:mx-auto">
        <div className="mt-10">
          <h1 className="text-xl font-semibold tracking-tight text-ink-900">
            Add your mobile number
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
            Google does not share a phone number, and providers need one to reach
            you about a booking. Add yours to finish setting up.
          </p>
        </div>

        <CompleteProfileForm />

        <p className="mt-4 text-center text-xs text-ink-500">
          You can{" "}
          <Link href="/account" className="underline">
            skip this for now
          </Link>{" "}
          and browse, but you will not be able to book until it is added.
        </p>
      </div>
    </main>
  );
}
