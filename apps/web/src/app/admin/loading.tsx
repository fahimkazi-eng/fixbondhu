import { PanelSkeleton } from "@/components/skeletons";

/**
 * Admin surface, mid-load.
 *
 * Chrome-free for the same reason as the customer and pro loaders: admin/layout
 * renders the shell, this only replaces the page. Admin queries are the heaviest
 * in the app — verification queues and audit logs run aggregate counts across
 * the whole table — so this is the skeleton most likely to be seen.
 */
export default function Loading() {
  return <PanelSkeleton count={5} className="py-6" />;
}
