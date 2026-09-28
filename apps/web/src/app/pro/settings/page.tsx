import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SignOutButton } from "@/components/sign-out-button";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Provider settings.
 *
 * Account-level things only. Commercial terms (commission, cancellation fees)
 * are deliberately absent: those are platform settings owned by admin, and a
 * provider being able to see but not change them is the correct boundary.
 */
export default async function ProviderSettingsPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/pro/settings");

  const [methods, profile, settings] = await Promise.all([
    user.providerProfileId
      ? prisma.providerPayoutMethod.findMany({
          where: { providerProfileId: user.providerProfileId, deletedAt: null },
        })
      : Promise.resolve([]),
    user.providerProfileId
      ? prisma.providerProfile.findUnique({
          where: { id: user.providerProfileId },
          select: { status: true, maxConcurrentJobs: true, acceptsUrgentJobs: true, slug: true },
        })
      : Promise.resolve(null),
    prisma.setting.findMany({
      where: { group: "finance" },
      orderBy: { key: "asc" },
    }),
  ]);

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-semibold tracking-tight text-ink-900">Settings</h1>

      {/* ---- account ---- */}
      <section className="card mt-4 p-5">
        <h2 className="text-sm font-semibold text-ink-900">Account</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <Row label="Name">{user.name}</Row>
          <Row label="Mobile">{user.phone}</Row>
          <Row label="Email">{user.email ?? "Not provided"}</Row>
          <Row label="Phone verified">{user.phoneVerified ? "Yes" : "Not yet"}</Row>
          {profile ? (
            <>
              <Row label="Provider status">
                {profile.status.replaceAll("_", " ").toLowerCase()}
              </Row>
              <Row label="Public profile">
                <Link
                  href={`/providers/${profile.slug}`}
                  className="text-brand-300 underline"
                >
                  View
                </Link>
              </Row>
            </>
          ) : null}
        </dl>
        <div className="mt-4 flex gap-2">
          <Link href="/account" className="btn btn-secondary">
            Customer account
          </Link>
          <SignOutButton />
        </div>
      </section>

      {/* ---- payouts ---- */}
      <section className="card mt-4 p-5">
        <h2 className="text-sm font-semibold text-ink-900">Payout method</h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-600">
          Where FixBondhu sends your earnings. Payouts cannot be released until a
          method is on file and verified.
        </p>
        {methods.length === 0 ? (
          <p className="mt-3 rounded-md tone-warning px-3 py-2 text-sm">
            No payout method on file. Adding one is not built yet, so earnings stay
            on your balance until it is.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {methods.map((method) => (
              <li key={method.id} className="rounded-lg border border-ink-200 p-3 text-sm">
                <p className="font-medium text-ink-900">{method.type}</p>
                <p className="text-xs text-ink-500">
                  {method.accountName} · ending {method.accountNumber.slice(-4)}
                </p>
                <p className="mt-1 text-xs">
                  {method.isVerified ? (
                    <span className="text-green-700">Verified</span>
                  ) : (
                    <span className="text-amber-700">Awaiting verification</span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- platform terms, read only ---- */}
      {settings.length > 0 ? (
        <section className="card mt-4 p-5">
          <h2 className="text-sm font-semibold text-ink-900">Platform terms</h2>
          <p className="mt-1 text-xs text-ink-600">
            Set by FixBondhu and applied to every provider. Shown here so there are
            no surprises; contact support to discuss them.
          </p>
          <dl className="mt-3 space-y-2 text-sm">
            {settings.map((setting) => (
              <div key={setting.key} className="flex justify-between gap-3">
                <dt className="text-ink-500">{setting.description ?? setting.key}</dt>
                <dd className="text-right font-medium tabular-nums text-ink-900">
                  {formatSetting(setting.key, setting.value)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </div>
  );
}

function formatSetting(key: string, value: unknown): string {
  if (typeof value === "boolean") return value ? "On" : "Off";
  if (key.includes("Poisha")) {
    const n = Number(value);
    return Number.isFinite(n) ? `৳${(n / 100).toLocaleString("en-US")}` : "—";
  }
  if (key.includes("Hours")) return `${value}h`;
  if (key.includes("Bps")) return `${(Number(value) / 100).toFixed(0)}%`;
  return String(value);
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-500">{label}</dt>
      <dd className="text-right text-ink-900">{children}</dd>
    </div>
  );
}
