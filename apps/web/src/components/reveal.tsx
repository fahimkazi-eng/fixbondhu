"use client";

import { useLayoutEffect, useRef, useState, type ElementType, type ReactNode } from "react";

/**
 * Reveals children as they scroll into view.
 *
 * The single highest-value animation on a page this long. Without it a
 * marketplace index is a flat wall of identical cards; with it, sections arrive
 * in order and the eye is guided down the page.
 *
 * The important design rule here is that content is VISIBLE BY DEFAULT. The
 * hidden state lives in a `data-state="hidden"` attribute that this component
 * sets itself, in a layout effect, and only for elements that are actually below
 * the fold. So:
 *
 *   - no JavaScript, blocked JS, or a failed hydration leaves content readable
 *   - reduced-motion users are never hidden at all
 *   - anything already on screen is shown without a hidden phase, so there is no
 *     flash
 *
 * An earlier version did the opposite: CSS set opacity 0 unconditionally and
 * JavaScript removed it, gated behind a pre-hydration script that added a class
 * to <html>. That arrangement made a blank page a real possibility, and the
 * literal <head> the script needed broke hydration of the whole document, so the
 * observer never ran and the content simply stayed invisible. Progressive
 * enhancement in this direction cannot fail that way.
 */
export function Reveal({
  children,
  className,
  as: Tag = "div",
  size = "sm",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  /**
   * "sm" is the default 18px rise for cards and lists. "lg" is the heavier
   * 34px rise for a full section, which reads as arriving rather than
   * appearing.
   */
  size?: "sm" | "lg";
  /** Stagger for a heading that should land just after its section. */
  delay?: number;
}) {
  // "idle" means untouched, so the server markup carries no data-state at all
  // and the stylesheet shows it.
  const [state, setState] = useState<"idle" | "hidden" | "shown">("idle");
  const ref = useRef<HTMLElement | null>(null);

  // Layout effect, not effect: it runs after the DOM is mutated but before the
  // browser paints, so toggling a below-the-fold element to hidden is never
  // seen.
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced || typeof IntersectionObserver === "undefined") {
      setState("shown");
      return;
    }

    // Anything already within reading distance is shown straight away, so the
    // first screen never animates in and never flashes.
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.92) {
      setState("shown");
      return;
    }

    setState("hidden");

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setState("shown");
        // One shot. Re-hiding on the way back up makes a page feel like it is
        // playing on a loop, which is tiring rather than lively.
        observer.disconnect();
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.01 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const Wrapper = Tag as ElementType;

  return (
    <Wrapper
      ref={ref}
      data-state={state === "idle" ? undefined : state}
      // The delay is capped at 240ms. Beyond that the section is no longer
      // arriving with its neighbours, it is arriving on its own, and waiting for
      // a previous element to finish is just latency.
      style={delay > 0 ? { transitionDelay: `${Math.min(delay, 240)}ms` } : undefined}
      className={`reveal ${size === "lg" ? "reveal-lg" : ""} ${className ?? ""}`}
    >
      {children}
    </Wrapper>
  );
}
