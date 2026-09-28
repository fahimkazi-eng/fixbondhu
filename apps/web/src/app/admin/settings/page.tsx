import type { Metadata } from "next";

import { requireStaff } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SettingEditor } from "@/components/setting-editor";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Platform settings.
 *
 * requireStaff with settings:manage, which only ADMIN holds. SUPPORT and
 * VERIFICATION staff reach this file and are refused, because being able to
 * change commission or cancellation fees is not a support function.
 */
export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  await requireStaff("settings:manage");
  const { denied } = await searchParams;

  const settings = await prisma.setting.findMany({
    orderBy: [{ group: "asc" }, { key: "asc" }],
    select: { key: true, value: true, description: true, group: true },
  });

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-semibold tracking-tight text-ink-900">Settings</h1>
      <p className="mt-1.5 text-sm text-ink-600">
        Commercial rules live here rather than in code, so they can be changed
        without a deploy. Every change is recorded in the audit log with its
        previous value.
      </p>

      {denied ? (
        <p className="mt-3 rounded-md tone-warning px-3 py-2 text-sm">
          Your role cannot change platform settings.
        </p>
      ) : null}

      <div className="mt-5">
        <SettingEditor settings={settings} />
      </div>
    </div>
  );
}
