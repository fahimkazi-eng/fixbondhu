import Link from "next/link";
import type { Metadata } from "next";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatPoisha } from "@fixbondhu/core";

export const metadata: Metadata = { title: "Saved providers", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SavedProvidersPage() {
  const user = await requireUser("/account/saved");

  const saved = await prisma.savedProvider.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      provider: {
        include: {
          services: {
            where: { isActive: true },
            orderBy: { minPricePoisha: "asc" },
            take: 1,
          },
          verifications: { where: { status: "APPROVED" }, select: { type: true } },
        },
      },
    },
  });

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-semibold tracking-tight text-ink-900">
        Saved providers
      </h1>

      {saved.length === 0 ? (
        <p className="card mt-4 p-8 text-center text-sm text-ink-600">
          You have not saved anyone yet. Saving a provider is not built yet, so
          nothing is listed here rather than showing suggestions you did not pick.
        </p>
      ) : (
        <ul className="stagger mt-4 space-y-2">
          {saved.map((entry, index) => (
            <li
              key={entry.id}
              style={{ "--i": Math.min(index, 8) } as React.CSSProperties}
            >
              <Link
                href={`/providers/${entry.provider.slug}`}
                className="card interactive block p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-medium text-ink-900">
                      {entry.provider.displayName}
                    </p>
                    <p className="text-sm text-ink-600">
                      {entry.provider.headline ?? "No headline"}
                    </p>
                    <p className="mt-1 text-xs text-ink-500">
                      {entry.provider.verifications.length} verifications
                    </p>
                  </div>
                  <div className="text-right">
                    {entry.provider.services[0] ? (
                      <p className="text-sm font-medium tabular-nums text-ink-900">
                        from {formatPoisha(entry.provider.services[0].minPricePoisha)}
                      </p>
                    ) : null}
                    <p className="text-xs text-ink-500">
                      {entry.provider.ratingCount > 0
                        ? `${entry.provider.ratingAvg.toFixed(1)} ★`
                        : "No reviews"}
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
