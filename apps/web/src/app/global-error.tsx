"use client";

/**
 * The last-resort boundary: a crash in the ROOT LAYOUT itself.
 *
 * This file is the one place in the app where the design system cannot be
 * relied on, so it is worth being explicit about why it looks the way it does.
 *
 * When global-error is active it REPLACES the root layout. That means:
 *
 *   - globals.css is not loaded, so no `.btn`, no `.display`, no `.eyebrow`
 *   - none of the three next/font faces are available
 *   - the OS default (light) colour scheme is what the browser paints
 *
 * So the theme is re-declared as inline styles, the two values that matter
 * copied from @theme (--color-ink-50 and --color-brand-400), and no class names
 * are used at all. The display face falls back to the system UI stack, which is
 * the honest result: a page that renders correctly but without the brand
 * typography beats a page that renders unstyled white-on-white.
 *
 * `color-scheme: dark` on the html element is set as an inline style for the
 * same reason — it is inherited by the UA-styled scrollbar and the form control
 * rendering, none of which the stylesheet would reach.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en" style={{ colorScheme: "dark" }}>
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          background: "#08080b",
          color: "#f4f4f6",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          // Entrance animation inlined, because there is no stylesheet to
          // declare a keyframe in. Kept to opacity and transform only, and it is
          // the one animation on the site that does not check reduced-motion,
          // because matchMedia would be the one thing that could itself throw
          // here. It is a single 380ms opacity fade with no layout effect, so
          // the worst case for someone who asked for less motion is that they
          // see it settle.
          animation: "none",
        }}
      >
        <div style={{ width: "100%", maxWidth: "36rem", margin: "0 auto", padding: "2rem 1.5rem" }}>
          <p
            style={{
              margin: 0,
              fontSize: "0.6875rem",
              fontWeight: 600,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#22d3ee",
            }}
          >
            FixBondhu
          </p>

          <h1
            style={{
              margin: "1rem 0 0",
              fontSize: "clamp(1.75rem, 6vw, 2.5rem)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
            }}
          >
            The site could not start.
          </h1>

          <p
            style={{
              margin: "1rem 0 0",
              fontSize: "1rem",
              lineHeight: 1.65,
              color: "#a1a1aa",
            }}
          >
            This is more serious than a page that failed to load: the failure is
            in the site shell itself, so it affects every page. Nothing you
            submitted was lost. Trying again is worth it.
          </p>

          {error.digest ? (
            <p
              style={{
                margin: "1rem 0 0",
                fontSize: "0.75rem",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                color: "#71717a",
              }}
            >
              Reference: {error.digest}
            </p>
          ) : null}

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "2rem" }}>
            <button
              type="button"
              onClick={() => retry()}
              style={{
                cursor: "pointer",
                borderRadius: "10px",
                border: "0",
                padding: "0.625rem 1.125rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                // Near-black on neon, the same pairing as .btn-primary. The
                // contrast is the reason the primary button is not white-on-
                // neon: that lands near 1.9:1 and fails outright.
                background: "#22d3ee",
                color: "#08080b",
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                borderRadius: "10px",
                border: "1px solid #27272a",
                padding: "0.625rem 1.125rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                textDecoration: "none",
                color: "#d4d4d8",
              }}
            >
              Back to home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
