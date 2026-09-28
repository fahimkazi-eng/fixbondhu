import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { formatPoisha } from "@fixbondhu/core";

import { findProviders, getService } from "@/lib/marketplace";
import { ProviderCard } from "@/components/provider-card";
import {
  MobileTabBar,
  SiteFooter,
  SiteHeader,
  TabBarSpacer,
} from "@/components/site-chrome";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = await getService(slug);
  if (!service) return { title: "Service not found" };

  return {
    title: `${service.nameEn} — prices and available professionals`,
    description: service.descriptionEn
      ? `${service.nameEn}. ${service.providerCount} verified professionals available.`
      : `Book ${service.nameEn} from verified professionals on FixBondhu.`,
  };
}

/**
 * A single service, with the professionals who actually offer it.
 *
 * This route is the one every search result has linked to since search shipped,
 * so until now every one of those links 404'd. It is also where the marketplace
 * promise is either kept or broken: the price shown is a real price from a real
 * approved provider, and the count is a real count.
 */
export default async function ServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = await getService(slug);

  if (!service) notFound();

  // Only providers who offer THIS service, priced, approved.
  const providers = await findProviders({ serviceSlug: slug, limit: 24 });

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader path={`/services/${service.slug}`} signedInName={null} areaName={null} />

      <main id="main" className="container-page flex-1 py-6">
        <nav aria-label="Breadcrumb" className="text-xs text-ink-500">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/services" className="hover:underline">
                Services
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link
                href={`/services?category=${service.categorySlug}`}
                className="hover:underline"
              >
                {service.categoryNameEn}
              </Link>
            </li>
          </ol>
        </nav>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-ink-900">
              {service.nameEn}
            </h1>
            <p lang="bn" className="mt-0.5 text-base text-ink-600">
              {service.nameBn}
            </p>
            {service.nameBanglish ? (
              <p className="mt-0.5 text-sm text-ink-500">{service.nameBanglish}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {service.isEmergency ? <span className="chip">Urgent service</span> : null}
            <span className="chip">~{service.durationMinutes} min</span>
            {service.requiresVisit ? <span className="chip">On-site visit</span> : null}
          </div>
        </div>

        {service.descriptionEn ? (
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-700">
            {service.descriptionEn}
          </p>
        ) : null}

        {/*
          Supply line. Reads as a fact about the database, which is what it is.
          When there is no supply it says so rather than showing an empty grid.
        */}
        <p className="mt-5 border-y border-ink-200 py-3 text-sm text-ink-700">
          {providers.length === 0 ? (
            <>
              No professional is currently available for {service.nameEn}.{" "}
              <span className="text-ink-500">
                FixBondhu only shows approved providers, so this means the supply is
                genuinely not there yet.
              </span>
            </>
          ) : (
            <>
              <span className="font-medium tabular-nums">{providers.length}</span>{" "}
              {providers.length === 1 ? "professional" : "professionals"} available
              {service.fromPricePoisha !== null ? (
                <>
                  {" "}
                  from{" "}
                  <span className="font-medium tabular-nums text-ink-900">
                    {formatPoisha(service.fromPricePoisha)}
                  </span>
                </>
              ) : null}
              .
            </>
          )}
        </p>

        {providers.length > 0 ? (
          <>
            <div className="mt-5 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold tracking-tight text-ink-900">
                Available professionals
              </h2>
              <Link
                href={`/providers?service=${service.slug}`}
                className="text-sm text-brand-700 hover:underline"
              >
                Filter and sort
              </Link>
            </div>

            <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {providers.map((provider, i) => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  index={i}
                  highlightService={service.slug}
                />
              ))}
            </ul>
          </>
        ) : (
          <div className="card mt-5 p-8 text-center">
            <h2 className="text-sm font-semibold text-ink-900">
              Nobody available for {service.nameEn} yet
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-600">
              We would rather show you an honest empty result than fill this page
              with unverified names. If you do this work, applying takes a few
              minutes and your profile appears here once approved.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Link href="/services" className="btn btn-secondary">
                Browse other services
              </Link>
              <Link href="/pro" className="btn btn-primary">
                Apply as a provider
              </Link>
            </div>
          </div>
        )}

        {/* ---- how this works ---- */}
        <section className="mt-12 border-t border-ink-200 pt-6">
          <h2 className="text-sm font-semibold tracking-tight text-ink-900">
            How booking works
          </h2>
          <ol className="mt-3 grid gap-4 sm:grid-cols-3">
            {[
              {
                title: "Compare real prices",
                body: "Every price here comes from a provider who set it, not an estimate we invented.",
              },
              {
                title: "Book a time",
                body: "Pick a slot that suits you. Nothing is charged until the work is agreed.",
              },
              {
                title: "Approve any extras",
                body: "A provider cannot raise the total without your approval. Ever.",
              },
            ].map((step, i) => (
              <li key={step.title}>
                <p className="text-xs font-medium tabular-nums text-ink-400">
                  Step {i + 1}
                </p>
                <p className="mt-1 text-sm font-medium text-ink-900">{step.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-600">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <SiteFooter />
      <MobileTabBar path={`/services/${service.slug}`} />
      <TabBarSpacer />
    </div>
  );
}
