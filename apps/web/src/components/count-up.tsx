"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Counts a real number up when it scrolls into view.
 *
 * The number it lands on is passed in from the server and is a database count.
 * This only animates the journey to it, so it cannot invent a figure: whatever
 * the server said is what the reader ends up seeing. If JavaScript does not
 * run, the server-rendered value is what stands.
 *
 * The count is rendered as text, not as a live region, because a screen reader
 * announcing a number that is still climbing is worse than announcing it once.
 */
export function CountUp({
  value,
  className,
  durationMs = 520,
}: {
  value: number;
  className?: string;
  durationMs?: number;
}) {
  const [shown, setShown] = useState(value);
  const ref = useRef<HTMLSpanElement | null>(null);
  const started = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced || value === 0) {
      setShown(value);
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      setShown(value);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting) || started.current) return;
        started.current = true;
        observer.disconnect();

        // Ease-out cubic, so it moves quickly at first and settles gently. That
        // reads as counting rather than as a slot machine.
        const start = performance.now();
        let frame = 0;

        const tick = (now: number) => {
          const t = Math.min((now - start) / durationMs, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          setShown(Math.round(value * eased));
          if (t < 1) frame = requestAnimationFrame(tick);
          else setShown(value);
        };

        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
      },
      { threshold: 0.2 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [value, durationMs]);

  return (
    <span ref={ref} className={className}>
      {shown.toLocaleString("en-US")}
    </span>
  );
}
