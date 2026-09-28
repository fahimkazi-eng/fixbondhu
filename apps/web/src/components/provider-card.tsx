import Link from "next/link";

import { formatPoisha } from "@fixbondhu/core";

import type { MarketplaceProvider } from "@/lib/marketplace";

/**
 * A provider as a marketplace listing.
 *
 * Everything here comes from MarketplaceProvider, which only ever carries values
 * read from the database. The component's job is mostly to decide what NOT to
 * say, which is why the three subtractions below matter more than the additions:
 *
 *   - no rating is printed unless there are enough reviews behind it
 *   - no response-time claim, because nothing measures it
 *   - sponsored sits in a dashed neutral badge, never beside a trust badge
 */
export function ProviderCard({
  provider,
  index = 0,
  highlightService,
}: {
  provider: MarketplaceProvider;
  /** Caps the stagger delay; past a few items it stops being legible. */
  index?: number;
  /** Slug of the service being viewed, to lead with its price. */
  highlightService?: string;
}) {
  const name = provider.businessName || provider.displayName;
  const hasRating = provider.ratingAvg !== null;

  return (
    <li
      className="animate-rise"
      style={{ "--i": Math.min(index, 8) } as React.CSSProperties}
    >
      {/*
       * `hover-lift` rather than `interactive`. The brief asks for a 4px rise on
       * provider cards specifically, because they are what a reader is
       * comparing. The pointer-only guard lives in the class, so a tap on a
       * phone does not leave the card stuck in a raised state.
       */}
      <article
        className={`card hover-lift flex h-full flex-col p-4${
          provider.isSponsored ? " border-dashed" : ""
        }`}
      >
        <div className="flex items-start gap-3">
          {/*
            No stock photos and no generated avatars. Either the provider has
            uploaded a real one or this renders their initials, which is honest
            in a way a smiling stock portrait is not.
          */}
          {provider.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={provider.photoUrl}
              alt=""
              className="media-zoom h-12 w-12 shrink-0 rounded-lg object-cover"
              loading="lazy"
            />
          ) : (
            <span
              aria-hidden
              className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-ink-100 text-sm font-semibold text-ink-600"
            >
              {initials(name)}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold tracking-tight text-ink-900">
              <Link href={`/providers/${provider.slug}`} className="hover:underline">
                {name}
              </Link>
            </h3>

            {provider.headline ? (
              <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-ink-600">
                {provider.headline}
              </p>
            ) : null}
          </div>
        </div>

        {/* Sponsored is visually separate from verification on purpose. */}
        {provider.isSponsored ? (
          <p className="mt-3">
            <span className="badge-sponsored">Sponsored</span>
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-600">
          {hasRating ? (
            <span className="inline-flex items-center gap-1">
              <span aria-hidden className="text-amber-500">
                {"★".repeat(Math.round(provider.ratingAvg!))}
              </span>
              <span className="tabular-nums font-medium text-ink-900">
                {provider.ratingAvg!.toFixed(1)}
              </span>
              {/* The count is always shown. A bare "4.8" invites the reader to
                  assume a sample size it may not have. */}
              <span className="text-ink-500">({provider.ratingCount})</span>
            </span>
          ) : (
            /*
              Below the threshold the review count is still stated plainly, just
              without a star. Saying "New on FixBondhu" next to "290 jobs
              completed" was both confusing and vaguer than the truth, which is
              simply that nobody has reviewed them yet.
            */
            <span className="text-ink-500">
              {provider.ratingCount === 0
                ? "No reviews yet"
                : `${provider.ratingCount} ${provider.ratingCount === 1 ? "review" : "reviews"}`}
            </span>
          )}

          {provider.completedJobs > 0 ? (
            <span className="tabular-nums">{provider.completedJobs} jobs completed</span>
          ) : null}

          {provider.experienceYears > 0 ? (
            <span className="tabular-nums">{provider.experienceYears} yrs</span>
          ) : null}
        </div>

        {provider.verifiedTypes.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {provider.verifiedTypes.map((type) => (
              <li key={type}>
                <span className="badge-verified">{VERIFICATION_LABEL[type] ?? type}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {provider.areaNames.length > 0 ? (
          <p className="mt-3 truncate text-xs text-ink-500">
            Serves {provider.areaNames.join(", ")}
          </p>
        ) : null}

        {/* Pushed to the bottom so cards in a row line their prices up. */}
        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <div>
            {priceFor(provider, highlightService) !== null ? (
              <>
                <p className="text-xs text-ink-500">From</p>
                <p className="text-base font-semibold tabular-nums tracking-tight text-ink-900">
                  {formatPoisha(priceFor(provider, highlightService)!)}
                </p>
              </>
            ) : (
              <p className="text-xs text-ink-500">Ask for a quote</p>
            )}
          </div>

          <div className="flex gap-2">
            <Link
              href={`/providers/${provider.slug}`}
              className="btn btn-secondary px-3 py-1.5 text-xs"
            >
              View
            </Link>
            <Link
              href={`/providers/${provider.slug}#book`}
              className="btn btn-primary px-3 py-1.5 text-xs"
            >
              Book
            </Link>
          </div>
        </div>
      </article>
    </li>
  );
}

/**
 * The price to lead with.
 *
 * Prefers the price for the service actually being viewed over the provider's
 * cheapest overall, because "AC repair from ৳500" is the useful number and
 * "plumbing from ৳300" is not an answer to that question. Falls back to the
 * lowest overall price when the provider does not offer the highlighted service.
 */
function priceFor(
  provider: MarketplaceProvider,
  highlightService: string | undefined,
): number | null {
  if (highlightService) {
    const specific = provider.servicePrices[highlightService];
    if (specific !== undefined) return specific;
  }
  return provider.fromPricePoisha;
}

const VERIFICATION_LABEL: Record<string, string> = {
  PHONE: "Phone verified",
  IDENTITY: "ID verified",
  BUSINESS: "Business verified",
  CERTIFICATE: "Certified",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}
