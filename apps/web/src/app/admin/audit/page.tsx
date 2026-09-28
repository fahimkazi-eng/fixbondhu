import type { Metadata } from "next";

import { requireStaff } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatPoisha } from "@fixbondhu/core";

export const metadata: Metadata = { title: "Audit log", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Audit log.
 *
 * Every sensitive administrative action writes here: verification decisions,
 * suspensions, refunds, payouts, role changes and setting changes. It is
 * append-only from the application's point of view — there is no action anywhere
 * that updates or deletes a row, because an audit trail that can be edited is
 * not one.
 */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; entity?: string; q?: string }>;
}) {
  await requireStaff("audit:read");
  const { action, entity, q } = await searchParams;

  const entries = await prisma.auditLog.findMany({
    where: {
      ...(action ? { action: action as never } : {}),
      ...(entity ? { entityType: entity } : {}),
      ...(q
        ? { OR: [{ summary: { contains: q, mode: "insensitive" as const } }, { entityId: { contains: q } }] }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { actor: { select: { name: true, phone: true } } },
  });

  const actions = ["CREATE", "APPROVE", "REJECT", "SUSPEND", "RESTORE", "REFUND", "PAYOUT", "RESOLVE", "SETTINGS_UPDATE", "ROLE_CHANGE", "UPDATE"];

  return (
    <div className="max-w-4xl">
      <h1 className="text-lg font-semibold tracking-tight text-ink-900">Audit log</h1>
      <p className="mt-1.5 text-sm text-ink-600">
        Append-only record of sensitive actions. Nothing here can be edited or
        removed from the application.
      </p>

      <nav className="mt-4 flex flex-wrap items-center gap-1" aria-label="Filter audit log">
        <a
          href="/admin/audit"
          aria-current={!action ? "page" : undefined}
          className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${
            !action ? "tone-accent" : "border-ink-300 bg-ink-100 text-ink-600"
          }`}
        >
          All
        </a>
        {actions.map((key) => (
          <a
            key={key}
            href={`/admin/audit?action=${key}`}
            aria-current={action === key ? "page" : undefined}
            className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${
              action === key
                ? "tone-accent"
                : "border-ink-300 bg-ink-100 text-ink-600"
            }`}
          >
            {key.toLowerCase().replaceAll("_", " ")}
          </a>
        ))}
      </nav>

      {entries.length === 0 ? (
        <p className="card mt-4 p-8 text-center text-sm text-ink-600">
          No audit entries yet. They appear as staff perform sensitive actions.
        </p>
      ) : (
        <ul className="stagger mt-4 space-y-1.5">
          {entries.map((entry, index) => (
            <li
              key={entry.id}
              className="card animate-slide-in p-3"
              style={{ "--i": Math.min(index, 12) } as React.CSSProperties}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <span className="chip mr-2 align-middle">{entry.action.toLowerCase()}</span>
                  <span className="text-sm text-ink-900">{entry.summary ?? entry.entityType}</span>
                </div>
                <span className="shrink-0 text-xs text-ink-400">
                  {new Date(entry.createdAt).toLocaleString("en-GB", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="mt-1 text-xs text-ink-500">
                {entry.actor?.name ?? "system"} ({entry.actorRole ?? "unknown role"}) ·{" "}
                {entry.entityType} {entry.entityId.slice(0, 10)}
                {entry.ip ? ` · ${entry.ip}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
