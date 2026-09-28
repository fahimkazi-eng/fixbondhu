/**
 * The FixBondhu mark.
 *
 * A glyph, not a letter. An "F" rendered in a display face at 14px is a blob,
 * and it would also tie the identity to a specific typeface. So the mark is
 * drawn as geometry: a vertical stroke and two arms, one shorter than the other,
 * which reads as an F, as a signal-strength indicator, and as a checklist.
 *
 * Two details carry it:
 *
 *   1. The gradient runs corner to corner rather than top to bottom, so the tile
 *      has a light source. A flat fill at this size looks like a placeholder.
 *   2. The cut corner is a single clipped path, not a separate overlay shape, so
 *      the mark is one <svg> with no second element to keep in sync at other
 *      sizes.
 *
 * `aria-hidden` because every place that uses it also renders the wordmark or an
 * accessible link label. A logo announced as "graphic, FixBondhu logo" on top
 * of a link already labelled "FixBondhu, home" is noise.
 */
export function BrandMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-[9px] ${className}`}
      style={{
        background:
          "linear-gradient(140deg, var(--color-brand-300) 0%, var(--color-brand-500) 52%, var(--color-brand-700) 100%)",
        boxShadow:
          "inset 0 1px 0 rgb(255 255 255 / 35%), 0 2px 10px -3px color-mix(in oklab, var(--color-brand-400) 70%, transparent)",
      }}
    >
      <svg viewBox="0 0 24 24" className="h-[68%] w-[68%]" fill="none">
        {/* The arms, drawn as one path so they share a single edge weight. */}
        <path
          d="M7 19V5h10M7 11.5h7"
          stroke="#05060a"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
