import Link from "next/link";
import type { Metadata } from "next";

import { requireStaff } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatBdPhone, formatPoisha } from "@fixbondhu/core";

export const metadata: Metadata = { title: "Customers", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Customer accounts, with their real activity. No invented engagement metrics. */
export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireStaff();
  const { q } = await searchParams;

  const customers = await prisma.user.findMany({
    where: {
      deletedAt: null,
      customerProfile: { isNot: null },
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { phone: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      customerProfile: {
        select: {
          id: true,
          referralCode: true,
          isBanned: true,
          banReason: true,
        },
      },
      _count: { select: { bookings: true, reviews: true, addresses: true } },
      bookings: {
        select: { totalPoisha: true, paymentStatus: true },
      },
    },
  });

  return (
    <div className="max-w-4xl">
      <h1 className="text-lg font-semibold tracking-tight text-ink-900">Customers</h1>

      <form action="/admin/customers" className="mt-4 flex gap-1">
        <label className="sr-only" htmlFor="q">
          Search customers
        </label>
        <input
          className="input h-9 w-full max-w-xs text-sm"
          id="q"
          name="q"
          type="search"
          defaultValue={q ?? ""}
          placeholder="Name or mobile number"
        />
        <button className="btn btn-secondary" type="submit">
          Search
        </button>
      </form>

      {customers.length === 0 ? (
        <p className="card mt-4 p-8 text-center text-sm text-ink-600">
          No customers match.
        </p>
      ) : (
        <ul className="stagger mt-4 space-y-2">
          {customers.map((customer, index) => {
            // Only captured payments count as money a customer has actually paid.
            const spent = customer.bookings
              .filter((b) => b.paymentStatus === "CAPTURED")
              .reduce((sum, b) => sum + b.totalPoisha, 0);

            return (
              <li
                key={customer.id}
                className="card animate-rise p-4"
                style={{ "--i": Math.min(index, 10) } as React.CSSProperties}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[15px] font-medium text-ink-900">{customer.name}</p>
                      {customer.customerProfile?.isBanned ? (
                        <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-700">
                          banned
                        </span>
                      ) : null}
                      {!customer.phoneVerifiedAt ? (
                        <span className="chip">not verified</span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {formatBdPhone(customer.phone ?? "")}
                      {customer.email ? ` · ${customer.email}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-ink-500">
                      {customer._count.bookings} bookings · {customer._count.reviews} reviews
                      · {customer._count.addresses} addresses · joined{" "}
                      {new Date(customer.createdAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-medium tabular-nums text-ink-900">
                      {formatPoisha(spent)}
                    </p>
                    <p className="text-xs text-ink-500">paid to date</p>
                    {customer.customerProfile ? (
                      <p className="mt-1 text-xs text-ink-400">
                        ref {customer.customerProfile.referralCode}
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
