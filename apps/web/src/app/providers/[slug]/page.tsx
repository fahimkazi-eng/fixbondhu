import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { formatPoisha, formatPoishaRange, formatBdPhone } from "@fixbondhu/core";

import { prisma } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { BookingForm } from "@/components/booking-form";
import { CopyButton } from "@/components/copy-button";

export const dynamic = "force-dynamic";

const VERIFICATION_LABELS: Record<string, string> = {
  PHONE: "Phone verified",
  IDENTITY: "ID verified",
  BUSINESS: "Business verified",
  CERTIFICATE: "Certificate verified",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const provider = await prisma.providerProfile.findUnique({
    where: { slug },
    select: { displayName: true, headline: true, bio: true },
  });
  if (!provider) return { title: "Provider not found" };

  return {
    title: `${provider.displayName} — verified local service provider`,
    description:
      provider.headline ??
      provider.bio?.slice(0, 150) ??
      `${provider.displayName} on FixBondhu.`,
  };
}

/**
 * Public provider profile.
 *
 * Verification badges are rendered from APPROVED ProviderVerification rows
 * only, so a badge cannot appear without a real approval behind it. Sponsorship
 * uses a visually distinct dashed chip so paid placement can never be mistaken
 * for a trust signal.
 */
export default async function ProviderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getUser();

  const provider = await prisma.providerProfile.findFirst({
    where: { slug, status: "ACTIVE", deletedAt: null },
    include: {
      services: {
        where: { isActive: true },
        include: { service: { include: { category: true } } },
        orderBy: { minPricePoisha: "asc" },
      },
      serviceAreas: { include: { location: true } },
      verifications: { where: { status: "APPROVED" }, select: { type: true } },
      reviews: {
        where: { status: "PUBLISHED" },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { customer: { select: { name: true } } },
      },
      user: { select: { phone: true } },
    },
  });

  if (!provider) notFound();

  const approved = provider.verifications.map((v) => v.type);
  const isSponsored = provider.isSponsored && (!provider.sponsoredUntil || provider.sponsoredUntil > new Date());

  // Ratings are recomputed from the rows that exist, never from a stored figure
  // that could drift away from them.
  const ratingStats = await prisma.review.aggregate({
    where: { providerProfileId: provider.id, status: "PUBLISHED" },
    _avg: { rating: true },
    _count: true,
  });

  const addresses = user
    ? await prisma.address.findMany({
        where: { userId: user.id, deletedAt: null },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      })
    : [];

  return (
    <div className="min-h-dvh bg-ink-50">
      <header className="border-b border-ink-200 bg-white">
        <div className="container-page flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span aria-hidden className="grid h-7 w-7 place-items-center rounded-md bg-brand-700 text-sm font-bold text-white">F</span>
            <span className="text-[15px] font-semibold tracking-tight">FixBondhu</span>
          </Link>
          {user ? (
            <Link href="/account" className="btn btn-secondary">Account</Link>
          ) : (
            <Link href="/login" className="btn btn-secondary">Sign in</Link>
          )}
        </div>
      </header>

      <main id="main" className="container-page py-6">
        {/* ---- header ---- */}
        <section className="card animate-rise p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-ink-900">
                  {provider.displayName}
                </h1>
                {isSponsored ? (
                  <span className="badge-sponsored" title="Paid placement. Not a verification.">
                    Sponsored
                  </span>
                ) : null}
              </div>

              {provider.headline ? (
                <p className="mt-1 text-sm text-ink-600">{provider.headline}</p>
              ) : null}

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {approved.map((type) => (
                  <span key={type} className="badge-verified">
                    <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden fill="currentColor">
                      <path d="M8 1l1.9 1.2 2.2-.2.6 2.2 1.8 1.4-.8 2.1.8 2.1-1.8 1.4-.6 2.2-2.2-.2L8 15l-1.9-1.2-2.2.2-.6-2.2L1.5 10.4l.8-2.1-.8-2.1 1.8-1.4.6-2.2 2.2.2L8 1zm2.9 4.6L7.2 9.3 5.4 7.6l-1 1 2.8 2.7 4.2-4.1-1-1z" />
                    </svg>
                    {VERIFICATION_LABELS[type] ?? type}
                  </span>
                ))}
                {approved.length === 0 ? (
                  <span className="chip">Verification in progress</span>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-lg font-semibold tabular-nums text-ink-900">
                  {ratingStats._count > 0 ? (ratingStats._avg.rating ?? 0).toFixed(1) : "—"}
                </p>
                <p className="text-xs text-ink-500">
                  {ratingStats._count > 0
                    ? `${ratingStats._count} review${ratingStats._count === 1 ? "" : "s"}`
                    : "No reviews yet"}
                </p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold tabular-nums text-ink-900">
                  {provider.completedJobs}
                </p>
                <p className="text-xs text-ink-500">Jobs done</p>
              </div>
            </div>
          </div>

          <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-ink-100 pt-4 text-sm">
            <div>
              <dt className="text-xs text-ink-500">Experience</dt>
              <dd className="text-ink-900">
                {provider.experienceYears === 0
                  ? "Not stated"
                  : `${provider.experienceYears} year${provider.experienceYears === 1 ? "" : "s"}`}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">Response rate</dt>
              <dd className="text-ink-900">
                {provider.responseRate > 0
                  ? `${Math.round(provider.responseRate * 100)}%`
                  : "Not enough data"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">Contact</dt>
              <dd className="text-ink-900">
                {user ? (
                  <span className="inline-flex items-center gap-2">
                    {formatBdPhone(provider.user.phone ?? "")}
                    <CopyButton value={formatBdPhone(provider.user.phone ?? "")} label="Copy" />
                  </span>
                ) : (
                  <Link href="/login" className="text-brand-700 underline">Sign in to see contact</Link>
                )}
              </dd>
            </div>
          </dl>

          {provider.bio ? (
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink-700">
              {provider.bio}
            </p>
          ) : null}

          {provider.serviceAreas.length > 0 ? (
            <div className="mt-4">
              <h2 className="text-xs font-medium text-ink-500">Covers</h2>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {provider.serviceAreas.map((area) => (
                  <span key={area.id} className="chip">
                    {area.location.nameEn}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-xs text-ink-500">Covers all areas.</p>
          )}
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_380px]">
          {/* ---- services ---- */}
          <section>
            <h2 className="text-base font-semibold tracking-tight text-ink-900">Services</h2>
            {provider.services.length === 0 ? (
              <p className="card mt-3 p-5 text-sm text-ink-600">
                This provider has not published any services yet.
              </p>
            ) : (
              <ul className="stagger mt-3 space-y-2">
                {provider.services.map((entry, index) => (
                  <li
                    key={entry.id}
                    className="card interactive p-4"
                    style={{ "--i": Math.min(index, 8) } as React.CSSProperties}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[15px] font-medium text-ink-900">{entry.service.nameEn}</p>
                        <p lang="bn" className="mt-0.5 text-sm text-ink-600">{entry.service.nameBn}</p>
                        {entry.scopeNote ? (
                          <p className="mt-1 text-xs text-ink-500">{entry.scopeNote}</p>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium tabular-nums text-ink-900">
                          {entry.priceMode === "FIXED"
                            ? formatPoisha(entry.minPricePoisha)
                            : formatPoishaRange(entry.minPricePoisha, entry.maxPricePoisha)}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-500">
                          {entry.priceMode === "NEGOTIABLE"
                            ? "Price agreed on site"
                            : entry.priceMode === "RANGE"
                              ? "Estimated range"
                              : "Fixed price"}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* ---- reviews ---- */}
            <h2 className="mt-8 text-base font-semibold tracking-tight text-ink-900">
              Reviews
            </h2>
            {provider.reviews.length === 0 ? (
              <p className="card mt-3 p-5 text-sm text-ink-600">
                No reviews yet. Reviews only appear here when a customer has had a
                real, completed booking.
              </p>
            ) : (
              <ul className="stagger mt-3 space-y-2">
                {provider.reviews.map((review, index) => (
                  <li
                    key={review.id}
                    className="card animate-fade-in p-4"
                    style={{ "--i": Math.min(index, 6) } as React.CSSProperties}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-ink-900">
                        {review.customer.name}
                      </p>
                      <span className="chip tabular-nums" aria-label={`${review.rating} out of 5`}>
                        {review.rating}/5
                      </span>
                    </div>
                    {review.title ? (
                      <p className="mt-1.5 text-sm font-medium text-ink-800">{review.title}</p>
                    ) : null}
                    <p className="mt-1 text-sm leading-relaxed text-ink-700">{review.body}</p>
                    {review.providerReply ? (
                      <p className="mt-2 border-l-2 border-ink-200 pl-3 text-sm text-ink-600">
                        <span className="font-medium">{provider.displayName} replied:</span>{" "}
                        {review.providerReply}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ---- booking ---- */}
          <aside className="lg:sticky lg:top-5 lg:self-start">
            <BookingForm
              providerServiceOptions={provider.services.map((s) => ({
                id: s.id,
                label: s.service.nameEn,
                priceLabel:
                  s.priceMode === "FIXED"
                    ? formatPoisha(s.minPricePoisha)
                    : formatPoishaRange(s.minPricePoisha, s.maxPricePoisha),
              }))}
              addresses={addresses.map((a) => ({
                id: a.id,
                label: `${a.label} — ${a.areaName}`,
              }))}
              signedIn={Boolean(user)}
              providerName={provider.displayName}
              slug={provider.slug}
            />
          </aside>
        </div>
      </main>
    </div>
  );
}
