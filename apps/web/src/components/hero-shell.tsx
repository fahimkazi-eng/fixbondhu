"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * The hero's depth layer, and the pointer/scroll source that drives it.
 *
 * Children are passed through untouched, so the hero copy stays a Server
 * Component and the data fetching that produced it is unaffected. Only the
 * wrapper is client.
 *
 * HOW THE MOTION IS BUILT
 *
 * Two custom properties are written to the wrapper element:
 *
 *   --px, --py   pointer position, normalised to -1..1
 *   --scroll     page scroll through the hero, normalised to 0..1
 *
 * Descendant layers with `.parallax` multiply those by a per-layer depth, so
 * three layers at different depths cost one listener. Nothing here sets React
 * state: a `useState` version of this re-rendered the whole hero — copy, search
 * form and all — on every pointer move.
 *
 * The pointer value is eased toward its target rather than applied directly.
 * That lag is the entire difference between a panel that feels like it is
 * mounted in space and one that feels like it is being dragged. The easing runs
 * inside the rAF loop rather than as a CSS transition, because a CSS transition
 * on a custom property cannot be composed across three layers.
 *
 * A NOTE ON COST
 *
 * The three ambient washes are blurred by 70px. That is expensive to composite,
 * and it is why they live behind a single `contain: paint` wrapper and never
 * animate anything except their own transform. A blurred element that is
 * animating width, or sitting above a scrolling list, would be a genuinely
 * noticeable frame cost on a mid-range Android.
 *
 * Under prefers-reduced-motion nothing is attached at all — not a listener, not
 * a loop. The static gradients still render; they just stop moving.
 */
export function HeroShell({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const reduceRef = useRef(false);

  useEffect(() => {
    // Captured into a local so the closures below are not re-narrowed on every
    // use: TypeScript forgets the null check inside a nested function.
    const root = rootRef.current;
    if (!root) return;
    const node: HTMLDivElement = root;

    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceRef.current = query.matches;
    if (query.matches) return;

    let frame = 0;
    // Target values, written by the event listeners.
    let targetX = 0;
    let targetY = 0;
    // Current values, eased toward the target inside the loop.
    let currentX = 0;
    let currentY = 0;
    let scroll = 0;

    function tick() {
      frame = 0;

      // 0.08 per frame is roughly a 200ms settle. Fast enough that the panel
      // still feels attached to the cursor, slow enough that it reads as mass.
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;

      node.style.setProperty("--px", currentX.toFixed(4));
      node.style.setProperty("--py", currentY.toFixed(4));
      node.style.setProperty("--scroll", scroll.toFixed(4));

      // Keep going while there is still something to move toward, so the loop
      // idles at rest instead of burning a frame budget for nothing.
      if (
        Math.abs(targetX - currentX) > 0.001 ||
        Math.abs(targetY - currentY) > 0.001
      ) {
        frame = requestAnimationFrame(tick);
      }
    }

    function schedule() {
      if (!frame) frame = requestAnimationFrame(tick);
    }

    function onPointerMove(event: PointerEvent) {
      // Fine pointers only. On touch, a pointermove fires while the reader is
      // scrolling, which would drag the hero sideways under their thumb.
      if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

      const rect = node.getBoundingClientRect();
      targetX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      targetY = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      schedule();
    }

    function onPointerLeave() {
      targetX = 0;
      targetY = 0;
      schedule();
    }

    function onScroll() {
      const height = node.offsetHeight || 1;
      scroll = Math.min(Math.max(window.scrollY / height, 0), 1);
      node.style.setProperty("--scroll", scroll.toFixed(4));
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    node.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
      node.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div ref={rootRef} className="relative isolate overflow-hidden">
      {/*
        Decorative only. aria-hidden and pointer-events-none, so the three
        blurred washes are never in the accessibility tree and never intercept a
        click on the search form sitting on top of them.
      */}
      <div aria-hidden className="ambient">
        <span />
        <span />
        <span />
        <div className="grid-lines" />
      </div>

      {children}
    </div>
  );
}
