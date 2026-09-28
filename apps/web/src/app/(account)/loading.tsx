import { PanelSkeleton } from "@/components/skeletons";

/**
 * Customer surface, mid-load.
 *
 * Chrome-free on purpose: a loading.tsx replaces this segment's page but not its
 * layout, so CustomerShell's header, section nav and search box are already on
 * screen and stay there. Rendering a second header would draw it twice.
 *
 * The panels are full-width rather than a card grid because the account surface
 * is a list of records — bookings, addresses, reviews — not a comparison grid.
 * A three-column skeleton on a bookings list is a visible promise that the page
 * will change shape the moment the data arrives.
 */
export default function Loading() {
  return <PanelSkeleton count={4} />;
}
