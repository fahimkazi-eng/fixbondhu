import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { saveProviderProfile, submitVerification, type ActionState } from "@/app/actions/provider";
import { ActionForm, FieldError } from "@/components/action-form";

export const metadata: Metadata = { title: "Profile", robots: { index: false } };
export const dynamic = "force-dynamic";

const VERIFICATION_LABELS: Record<string, string> = {
  PHONE: "Phone",
  IDENTITY: "National ID",
  BUSINESS: "Business registration",
  CERTIFICATE: "Trade certificate",
};

const VERIFICATION_TONE: Record<string, string> = {
  APPROVED: "border-green-200 bg-green-50 text-green-800",
  PENDING: "border-amber-200 bg-amber-50 text-amber-800",
  REJECTED: "border-red-200 bg-red-50 text-red-700",
  EXPIRED: "border-ink-200 bg-ink-50 text-ink-600",
};

/**
 * Profile and verification.
 *
 * Grouped on one screen because they are the same task from a provider's point
 * of view: make the profile believable enough that customers will book, and
 * prove it with documents. The status line states plainly what is still
 * outstanding, because "why am I not appearing in search" is the question every
 * new provider asks.
 */
export default async function ProviderProfilePage() {
  const user = await getUser();
  if (!user?.providerProfileId) redirect("/pro/services");

  const profile = await prisma.providerProfile.findUnique({
    where: { id: user.providerProfileId },
    include: {
      verifications: { orderBy: { createdAt: "desc" } },
      user: { select: { name: true, phone: true, email: true } },
    },
  });
  if (!profile) redirect("/pro/services");

  const approved = profile.verifications.filter((v) => v.status === "APPROVED");
  const hasIdentity = approved.some((v) => v.type === "IDENTITY");
  const hasBusiness = approved.some(
    (v) => v.type === "BUSINESS" || v.type === "CERTIFICATE",
  );

  return (
    <div className="max-w-3xl">
      <h1 className="text-lg font-semibold tracking-tight text-ink-900">Profile</h1>

      {/* ---- live status ---- */}
      <div
        className={`mt-4 rounded-[10px] border p-4 ${
          profile.status === "ACTIVE"
            ? "border-green-200 bg-green-50"
            : profile.status === "PENDING_REVIEW"
              ? "border-amber-200 bg-amber-50"
              : "border-ink-200 bg-white"
        }`}
      >
        <p className="text-sm font-medium text-ink-900">
          {profile.status === "ACTIVE"
            ? "You are live and can be booked"
            : profile.status === "PENDING_REVIEW"
              ? "Your details are being checked"
              : profile.status === "REJECTED"
                ? "Your application was not approved"
                : "Your profile is not yet visible to customers"}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ink-600">
          {profile.status === "ACTIVE"
            ? "Customers searching in your areas will see you and can send you requests."
            : profile.status === "REJECTED"
              ? profile.rejectionReason ?? "Check your verification submissions below."
              : hasIdentity && hasBusiness
                ? "Both required checks are approved. An administrator will confirm shortly."
                : "You need an approved national ID and either a business registration or a trade certificate before you can be published."}
        </p>
        {profile.status === "REJECTED" ? (
          <Link href="/pro/verification" className="btn btn-secondary mt-3">
            See what to fix
          </Link>
        ) : null}
      </div>

      {/* ---- edit profile ---- */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold text-ink-900">What customers see</h2>
        <ActionForm
          action={saveProviderProfile}
          submitLabel="Save profile"
          pendingLabel="Saving…"
          className="card mt-2 space-y-4 p-5"
        >
          <div>
            <label className="label" htmlFor="displayName">Name customers see</label>
            <input
              className="input"
              id="displayName"
              name="displayName"
              required
              minLength={2}
              maxLength={80}
              defaultValue={profile.displayName}
            />
            <FieldError />
          </div>

          <div>
            <label className="label" htmlFor="headline">One-line summary</label>
            <input
              className="input"
              id="headline"
              name="headline"
              maxLength={120}
              defaultValue={profile.headline ?? ""}
              placeholder="e.g. AC technician, 10 years in Dhanmondi"
            />
            <FieldError />
          </div>

          <div>
            <label className="label" htmlFor="bio">About your work</label>
            <textarea
              className="input min-h-28 resize-y"
              id="bio"
              name="bio"
              maxLength={1000}
              defaultValue={profile.bio ?? ""}
              placeholder="What you specialise in, what you carry, how you quote."
            />
            <FieldError />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="businessName">Business name (optional)</label>
              <input
                className="input"
                id="businessName"
                name="businessName"
                maxLength={120}
                defaultValue={profile.businessName ?? ""}
              />
            </div>
            <div>
              <label className="label" htmlFor="businessType">Trade (optional)</label>
              <input
                className="input"
                id="businessType"
                name="businessType"
                maxLength={80}
                defaultValue={profile.businessType ?? ""}
                placeholder="e.g. Refrigeration"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="experienceYears">Years of experience</label>
              <input
                className="input tabular-nums"
                id="experienceYears"
                name="experienceYears"
                type="number"
                inputMode="numeric"
                min={0}
                max={60}
                defaultValue={profile.experienceYears}
              />
              <FieldError />
            </div>
            <div>
              <label className="label" htmlFor="tradeLicenseNo">Trade licence no. (optional)</label>
              <input
                className="input"
                id="tradeLicenseNo"
                name="tradeLicenseNo"
                maxLength={60}
                defaultValue={profile.tradeLicenseNo ?? ""}
              />
            </div>
          </div>
        </ActionForm>
      </section>

      {/* ---- verification ---- */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold text-ink-900">Verification</h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-600">
          A verification badge appears on your profile only after an administrator
          approves it. Nothing is marked as verified automatically.
        </p>

        <ul className="mt-3 space-y-2">
          {(["IDENTITY", "BUSINESS", "CERTIFICATE"] as const).map((type) => {
            const record = profile.verifications.find((v) => v.type === type);
            return (
              <li
                key={type}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 ${
                  record ? VERIFICATION_TONE[record.status] : "border-ink-200 bg-white"
                }`}
              >
                <div>
                  <p className="text-sm font-medium">{VERIFICATION_LABELS[type]}</p>
                  <p className="text-xs opacity-80">
                    {record
                      ? record.status === "APPROVED"
                        ? "Approved"
                        : record.status === "PENDING"
                          ? "Under review"
                          : record.status === "REJECTED"
                            ? `Rejected: ${record.rejectionReason ?? "see note"}`
                            : "Expired"
                      : "Not submitted"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        {!hasIdentity || !hasBusiness ? (
          <div className="mt-4">
            <ActionForm
              action={submitVerification}
              submitLabel="Submit for review"
              pendingLabel="Submitting…"
              className="card space-y-4 p-5"
            >
              <div>
                <label className="label" htmlFor="type">What are you submitting?</label>
                <select className="input" id="type" name="type" required>
                  <option value="IDENTITY">National ID</option>
                  <option value="BUSINESS">Business registration</option>
                  <option value="CERTIFICATE">Trade certificate</option>
                </select>
                <FieldError />
              </div>
              <div>
                <label className="label" htmlFor="note">Note for the reviewer</label>
                <textarea
                  className="input min-h-20 resize-y"
                  id="note"
                  name="note"
                  maxLength={500}
                  placeholder="e.g. NID 1995..., trade certificate from BRTC, attached separately."
                />
                <p className="mt-1.5 text-xs text-ink-500">
                  Document upload is not built yet. Submitting records your request
                  and nothing is approved without a human review.
                </p>
              </div>
            </ActionForm>
          </div>
        ) : null}
      </section>
    </div>
  );
}
