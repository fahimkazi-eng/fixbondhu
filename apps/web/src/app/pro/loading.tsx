import { PanelSkeleton } from "@/components/skeletons";

/**
 * Provider surface, mid-load.
 *
 * The pro layout already renders ProviderShell, so this fills only the content
 * area. A professional checking their job list on a phone is doing it between
 * jobs, and this is the frame they see while a booking status resolves.
 */
export default function Loading() {
  return <PanelSkeleton count={4} />;
}
