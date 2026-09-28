import Link from "next/link";

/**
 * Small line icons for the mobile tab bar.
 *
 * Hand-drawn rather than pulled from an icon package: there are five of them,
 * and lucide-react is not a dependency. Same reasoning as CategoryIcon.
 */
const PATHS: Record<string, string> = {
  home: "M3 10.5L12 3l9 7.5M5.5 9.5V20a1 1 0 0 0 1 1H9.5v-6h5v6h3a1 1 0 0 0 1-1V9.5",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  calendar:
    "M4 6.5h16a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7.5a1 1 0 0 1 1-1zM3 11h18M8 3v4M16 3v4",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5a7.5 7.5 0 0 1 15 0",
};

export function TabIcon({
  name,
  className = "h-5 w-5",
}: {
  name: keyof typeof PATHS | string;
  className?: string;
}) {
  const d = PATHS[name];
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
