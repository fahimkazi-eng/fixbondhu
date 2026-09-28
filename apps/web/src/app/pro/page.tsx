import Link from "next/link";

import { prisma } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { formatPoisha } from "@fixbondhu/core";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/pro", label: "Overview" },
  { href: "/pro/requests", label: "Requests" },
  { href: "/pro/jobs", label: "Active jobs" },
  { href: "/pro/earnings", label: "Earnings" },
  { href: "/pro/profile", label: "Profile" },
  { href: "/pro/verification", label: "Verification" },
];

export default async function ProviderDashboard() {
  const user = await getUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-md">
        <h1 className="text-xl font-semibold tracking-tight text-ink-900">
          Provider sign-in
        </h1>
        <p className="mt-2 text-sm text-ink-600">
          Sign in to see requests, manage your services and track earnings.
        </p>
        <Link href="/login?next=/pro" className="btn btn-primary mt-5">
          Sign in
        </Link>
      </div>
    );
  }

  if (!user.providerProfileId) {
    return (
      <div className="mx-auto max-w-lg">
        <h1 className="text-xl font-semibold tracking-tight text-ink-900">
          Set up your provider profile
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          You are signed in as {user.name}. To start receiving work you need a
          provider profile, the services you offer, the areas you cover, and to
          complete identity verification.
        </p>
        <ol className="card mt-5 space-y-3 p-5 text-sm">
          {[
            "Create your profile and describe your work",
            "Add the services you offer and your prices",
            "Set the areas you can reach",
            "Submit identity and business documents for verification",
          ].map((step, index) => (
            <li key={step} className="flex gap-3">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink-100 text-xs font-medium text-ink-700">
                {index + 1}
              </span>
              <span className="text-ink-700">{step}</span>
            </li>
          ))}
        </ol>
        <Link href="/pro/signup" className="btn btn-primary mt-5">
          Create provider profile
        </Link>
      </div>
    );
  }

  // Real counts only. An empty dashboard is the truthful state on day one.
  const [profile, openRequests, activeJobs, monthEarnings, pending] = await Promise.all([
    prisma.providerProfile.findUnique({
      where: { id: user.providerProfileId },
      select: {
        status: true,
        completedJobs: true,
        ratingAvg: true,
        ratingCount: true,
        services: { where: { isActive: true }, select: { id: true } },
        serviceAreas: { where: { isActive: true }, select: { id: true } },
        verifications: { select: { type: true, status: true } },
      },
    }),
    prisma.booking.count({ where: { providerProfileId: user.providerProfileId, status: "REQUESTED" } }),
    prisma.booking.count({
      where: {
        providerProfileId: user.providerProfileId,
        status: { in: ["ACCEPTED", "ON_THE_WAY", "ARRIVED", "IN_PROGRESS"] },
      },
    }),
    prisma.payment.aggregate({
      where: {
        providerProfileId: user.providerProfileId,
        status: "CAPTURED",
        paidAt: { gte: startOfCurrentMonth() },
      },
      _sum: { providerAmountPoisha: true },
    }),
    prisma.booking.aggregate({
      where: {
        providerProfileId: user.providerProfileId,
        status: "COMPLETED",
        paymentStatus: { not: "CAPTURED" },
      },
      _count: true,
    }),
  ]);

  const approved = new Set(
    profile?.verifications.filter((v) => v.status === "APPROVED").map((v) => v.type) ?? [],
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink-900">
            {user.name}
          </h1>
          <p className="mt-0.5 text-sm text-ink-600">
            {profile?.status === "ACTIVE"
              ? "Active provider"
              : `Status: ${(profile?.status ?? "DRAFT").replaceAll("_", " ").toLowerCase()}`}
          </p>
        </div>
        <nav className="flex flex-wrap gap-1 text-sm">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="btn btn-secondary">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="New requests" value={openRequests} emphasis={openRequests > 0} />
        <Metric label="Active jobs" value={activeJobs} />
        <Metric
          label="Earned this month"
          value={formatPoisha(Number(monthEarnings._sum.providerAmountPoisha ?? 0))}
        />
        <Metric
          label="Rating"
          value={profile && profile.ratingCount > 0
            ? `${profile.ratingAvg.toFixed(1)} (${profile.ratingCount})`
            : "No reviews yet"}
        />
      </dl>

      {pending._count > 0 ? (
        <div className="mt-4 rounded-[10px] tone-warning p-4 text-sm">
          {pending._count} completed{" "}
          {pending._count === 1 ? "job is" : "jobs are"} awaiting payment
          settlement.
        </div>
      ) : null}

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <Panel
          title="Services"
          value={profile?.services.length ?? 0}
          empty="Add the services you offer so customers can find you."
          href="/pro/services"
        />
        <Panel
          title="Service areas"
          value={profile?.serviceAreas.length ?? 0}
          empty="Add the areas you can reach."
          href="/pro/areas"
        />
        <Panel
          title="Verification"
          value={approved.size}
          empty="Verification badges appear on your profile only after an administrator approves them."
          href="/pro/verification"
        />
      </section>
    </div>
  );
}

function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function Metric({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string | number;
  emphasis?: boolean;
}) {
  return (
    <div className={`card px-4 py-3 ${emphasis ? "border-brand-600" : ""}`}>
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight text-ink-900">
        {value}
      </dd>
    </div>
  );
}

function Panel({
  title,
  value,
  empty,
  href,
}: {
  title: string;
  value: number;
  empty: string;
  href: string;
}) {
  return (
    <div className="card p-4">
      <h2 className="text-sm font-medium text-ink-900">{title}</h2>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-ink-900">
        {value}
      </p>
      {value === 0 ? <p className="mt-1.5 text-xs leading-relaxed text-ink-500">{empty}</p> : null}
      <Link href={href} className="mt-3 inline-block text-xs font-medium text-brand-300 underline">
        Manage
      </Link>
    </div>
  );
}
