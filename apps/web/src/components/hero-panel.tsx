import Link from "next/link";

/**
 * The hero's right-hand panel: a layered stack of live marketplace state.
 *
 * This is where the design brief asked for "large hero imagery, layered cards".
 * There is no hero photograph in this build, and that is a decision, not an
 * omission.
 *
 * A stock image of a smiling technician is the single most common lie in a
 * services marketplace: it depicts a person who does not exist, who has not
 * been verified, and who is not available in the reader's area. This product's
 * entire claim to being different from a directory is that everything in it is
 * real. So the panel shows the actual numbers instead, which is also the only
 * image that can be interesting — it is different on every deployment.
 *
 * Consequently every prop is a count the page already read from the database.
 * If the marketplace is empty the panel renders the empty state rather than
 * falling back to placeholders, which is the same rule the rest of the page
 * follows.
 */
export function HeroPanel({
  serviceCount,
  providerCount,
  activeBookings,
  categoryCount,
  services,
}: {
  serviceCount: number;
  providerCount: number;
  activeBookings: number;
  categoryCount: number;
  services: { slug: string; nameEn: string; nameBn: string; providerCount: number }[];
}) {
  const hasSupply = providerCount > 0;

  return (
    <div
      className="relative mx-auto w-full max-w-sm lg:max-w-none"
      aria-hidden={false}
    >
      {/*
        The two cards behind. Purely visual depth, and deliberately barely
        visible — they are there to give the front card a plane to sit on, not
        to be read. aria-hidden because they contain no information.
      */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="card animate-rise-lg absolute inset-x-6 top-6 -rotate-6 opacity-40" />
        <div className="card animate-rise-lg absolute inset-x-3 top-3 rotate-3 opacity-70" />
      </div>

      <div
        className="card animate-rise-lg relative p-5"
        style={
          {
            "--depth-x": "18px",
            "--depth-y": "12px",
            "--depth-s": "14px",
          } as React.CSSProperties
        }
      >
        <div className="parallax">
          <div className="flex items-center justify-between gap-3">
            <span className="eyebrow">Marketplace state</span>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-500">
              <span
                aria-hidden
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-400"
              />
              live
            </span>
          </div>

          <dl className="mt-5 grid grid-cols-3 gap-3">
            <Figure value={serviceCount} label="Services" />
            <Figure value={providerCount} label="Verified" />
            <Figure value={activeBookings} label="In progress" />
          </dl>

          <div className="mt-5 border-t border-ink-300/60 pt-4">
            {hasSupply && services.length > 0 ? (
              <>
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-500">
                  Bookable right now
                </p>
                <ul className="mt-2.5 space-y-1">
                  {services.slice(0, 4).map((service) => (
                    <li key={service.slug}>
                      <Link
                        href={`/services/${service.slug}`}
                        className="group flex items-baseline justify-between gap-3 rounded-md px-1.5 py-1 transition-colors duration-200 hover:bg-ink-300/50"
                      >
                        <span className="truncate text-sm text-ink-800">
                          {service.nameEn}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-ink-500">
                          {service.providerCount}{" "}
                          {service.providerCount === 1 ? "pro" : "pros"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="mt-3.5 text-[11px] leading-relaxed text-ink-600">
                  {categoryCount} categories, all counts read from the database at
                  request time.
                </p>
              </>
            ) : (
              <p className="text-sm leading-relaxed text-ink-500">
                No verified providers are live yet. FixBondhu opens an area only
                once there is real supply to book, so rather than show a
                directory of people who cannot be reached, it shows nothing.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** A single number. tabular-nums so a CountUp-style change does not jitter. */
function Figure({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <dd className="display text-[26px] leading-none text-ink-900 tabular-nums">
        {value}
      </dd>
      <dt className="mt-1.5 text-[11px] leading-tight text-ink-500">{label}</dt>
    </div>
  );
}
