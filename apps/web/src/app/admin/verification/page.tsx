import Link from "next/link";
import type { Metadata } from "next";

import { requireStaff } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { VerificationDecision } from "@/components/verification-decision";

export const metadata: Metadata = { title: "Verification queue", robots: { index: false } };
export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  IDENTITY: "National ID",
  BUSINESS: "Business registration",
  CERTIFICATE: "Trade certificate",
};

/**
 * The verification queue.
 *
 * This is the single gate between a self-registered provider and a customer
 * handing over their address and a job. requireStaff with the provider:verify
 * permission runs before any row is read, so a SUPPORT agent — who can see this
 * link — is refused here, not just hidden from the menu.
 */
export default async function AdminVerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireStaff("provider:verify");
  const { status } = await searchParams;

  const where =
    status === "approved"
      ? { status: "APPROVED" as const }
      : status === "rejected"
        ? { status: "REJECTED" as const }
        : { status: "PENDING" as const };

  const verifications = await prisma.providerVerification.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: 100,
    include: {
      providerProfile: {
        include: {
          user: { select: { name: true, phone: true } },
          verifications: { select: { id: true, type: true, status: true } },
        },
      },
      reviewedBy: { select: { name: true } },
    },
  });

  const tabs = [
    { key: "pending", label: "Waiting" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
  ];

  return (
    <div className="max-w-3xl">
      <h1 className="text-lg font-semibold tracking-tight text-ink-900">
        Verification queue
      </h1>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
        Nobody appears to customers until identity and one business or trade
        document are approved here. Check the documents before approving.
      </p>

      <nav className="mt-4 flex flex-wrap gap-1" aria-label="Filter verifications">
        {tabs.map((tab) => {
          const active = (status ?? "pending") === tab.key;
          return (
            <a
              key={tab.key}
              href={tab.key === "pending" ? "/admin/verification" : `/admin/verification?status=${tab.key}`}
              aria-current={active ? "page" : undefined}
              className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 ${
                active
                  ? "tone-accent"
                  : "border-ink-300 bg-ink-100 text-ink-600 hover:border-ink-400"
              }`}
            >
              {tab.label}
            </a>
          );
        })}
      </nav>

      {verifications.length === 0 ? (
        <p className="card mt-4 p-8 text-center text-sm text-ink-600">
          Nothing in this queue.
        </p>
      ) : (
        <ul className="stagger mt-4 space-y-3">
          {verifications.map((verification, index) => {
            const profile = verification.providerProfile;
            const others = profile.verifications.filter(
              (v) => v.id !== verification.id,
            );

            return (
              <li
                key={verification.id}
                className="card animate-rise p-4"
                style={{ "--i": Math.min(index, 8) } as React.CSSProperties}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium text-ink-900">
                      {profile.displayName}
                    </p>
                    <p className="text-xs text-ink-500">
                      {profile.user.name} · {profile.user.phone}
                    </p>
                    <p className="mt-1 text-xs text-ink-500">
                      Submitted{" "}
                      {new Date(verification.createdAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    {others.map((other) => (
                      <span
                        key={other.type}
                        className={`chip ${
                          other.status === "APPROVED"
                            ? "tone-success"
                            : other.status === "PENDING"
                              ? "tone-warning"
                              : "tone-danger"
                        }`}
                      >
                        {TYPE_LABELS[other.type] ?? other.type}:{" "}
                        {other.status.toLowerCase()}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-3 rounded-md border border-ink-200 bg-ink-50 p-3">
                  <p className="text-xs font-medium text-ink-700">
                    {TYPE_LABELS[verification.type] ?? verification.type}
                  </p>
                  {(() => {
                    const meta = verification.documentMeta as
                      | { note?: string; documentsUploaded?: number }
                      | null;
                    const uploaded = meta?.documentsUploaded ?? 0;
                    return (
                      <>
                        <p className="mt-1 text-sm text-ink-700">
                          {meta?.note ?? "No note provided."}
                        </p>
                        <p className="mt-1.5 text-xs text-ink-500">
                          Documents attached: {uploaded}
                          {uploaded === 0
                            ? " — document upload is not built yet, so nothing can be visually checked"
                            : ""}
                        </p>
                      </>
                    );
                  })()}
                </div>

                {verification.status === "PENDING" ? (
                  <div className="mt-4">
                    <VerificationDecision
                      verificationId={verification.id}
                      providerName={profile.displayName}
                      type={TYPE_LABELS[verification.type] ?? verification.type}
                    />
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-ink-500">
                    {verification.status === "APPROVED" ? "Approved" : "Rejected"}
                    {verification.reviewedBy ? ` by ${verification.reviewedBy.name}` : ""}
                    {verification.reviewedAt
                      ? ` on ${new Date(verification.reviewedAt).toLocaleDateString("en-GB")}`
                      : ""}
                    {verification.rejectionReason ? ` — ${verification.rejectionReason}` : ""}
                  </p>
                )}

                <Link
                  href={`/admin/providers?focus=${profile.id}`}
                  className="mt-3 inline-block text-xs text-brand-300 underline"
                >
                  Open provider
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
