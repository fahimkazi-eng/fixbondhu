/**
 * Category icons.
 *
 * The seed stores an icon name per category, but lucide-react is not a
 * dependency and adding it for eleven glyphs would cost more than it is worth.
 * So the names are mapped to hand-written paths here.
 *
 * An unknown name renders nothing rather than a guess. A blank square is a
 * cosmetic gap; an icon that implies the wrong trade is a lie about what the
 * category is.
 */

const PATHS: Record<string, string> = {
  snowflake:
    "M12 2v20M4.93 4.93l14.14 14.14M2 12h20M4.93 19.07l14.14-14.14M12 6l-2.5-2.5M12 6l2.5-2.5M12 18l-2.5 2.5M12 18l2.5 2.5",
  zap: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  droplet: "M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z",
  refrigerator:
    "M5 2h14a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM4 10h16M9 6v2M9 14v2",
  hammer: "M15 12l-8.5 8.5a2.12 2.12 0 0 1-3-3L12 9M17.64 15L22 10.64M20.91 11.7L19.6 10.39a1.5 1.5 0 0 1 0-2.12l1.24-1.24a1.5 1.5 0 0 1 2.12 0l2.59 2.59a1.5 1.5 0 0 1 0 2.12l-1.24 1.24a1.5 1.5 0 0 1-2.12 0z",
  paintbrush: "M18.37 2.63L14 7l-1.59-1.59L16.82 2.64a2 2 0 0 1 2.83 0l1.73 1.73a2 2 0 0 1 0 2.83L12.75 15.83 9 12.08l8.37-9.45zM9 14l-3 3 4 4 3-3M6 17l-3 5 5-3",
  sparkles:
    "M12 2l1.9 5.1L19 9l-5.1 1.9L12 16l-1.9-5.1L5 9l5.1-1.9L12 2zM19 15l.95 2.55L22.5 18.5l-2.55.95L19 22l-.95-2.55L15.5 18.5l2.55-.95L19 15zM5 14l.7 1.8L7.5 16.5l-1.8.7L5 19l-.7-1.8L2.5 16.5l1.8-.7L5 14z",
  lock: "M5 11h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zM7.5 11V7a4.5 4.5 0 0 1 9 0v4",
  shield: "M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5l8-3zM9 12l2 2 4-4",
  building: "M3 21h18M5 21V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v16M13 21V10h6a1 1 0 0 1 1 1v10M8 8h2M8 12h2M8 16h2M16 14h1M16 18h1",
  wrench:
    "M14.7 6.3a4 4 0 0 0 5.3 5.3l-1.4-1.4-2.5.7.7-2.5-1.4-1.4a4 4 0 0 0-.7-.7zM14.7 6.3L4 17a2.12 2.12 0 1 0 3 3l10.7-10.7",
};

export function CategoryIcon({
  name,
  className = "h-5 w-5",
}: {
  name: string | null | undefined;
  className?: string;
}) {
  const d = name ? PATHS[name] : undefined;
  if (!d) return null;

  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {d.split("M").filter(Boolean).map((segment, i) => (
        <path key={i} d={`M${segment}`} />
      ))}
    </svg>
  );
}
