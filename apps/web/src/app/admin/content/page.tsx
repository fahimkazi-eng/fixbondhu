import type { Metadata } from "next";

import { requireStaff } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatPoisha } from "@fixbondhu/core";
import { CouponCreator } from "@/components/coupon-creator";

export const metadata: Metadata = { title: "Catalogue & promos", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Catalogue and promotions.
 *
 * Read-only for the catalogue itself: services and categories are seeded from
 * real Bangladesh geography and trade data, and editing them through an admin
 * form risks publishing a service the platform cannot actually dispatch. What is
 * editable is what is genuinely a business decision — coupons and referral
 * configuration.
 */
export default async function AdminContentPage() {
  await requireStaff("content:manage");

  const [categories, services, coupons, referralsEnabled] = await Promise.all([
    prisma.category.findMany({
      orderBy: { sequence: "asc" },
      include: { _count: { select: { services: true } } },
    }),
    prisma.service.findMany({
      orderBy: [{ category: { sequence: "asc" } }, { sequence: "asc" }],
      include: {
        category: { select: { nameEn: true } },
        _count: { select: { providerServices: { where: { isActive: true } } } },
      },
      take: 100,
    }),
    prisma.coupon.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
    prisma.setting.findUnique({ where: { key: "referral.enabled" } }),
  ]);

  return (
    <div className="max-w-4xl">
      <h1 className="text-lg font-semibold tracking-tight text-ink-900">
        Catalogue and promotions
      </h1>

      {/* ---- coupons ---- */}
      <section className="mt-5">
        <h2 className="text-sm font-semibold text-ink-900">Coupons</h2>
        {coupons.length === 0 ? (
          <p className="card mt-2 p-5 text-sm text-ink-600">
            No coupons yet. Coupons stay switched off until finance funds a
            campaign, so nobody can redeem one that has no budget behind it.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {coupons.map((coupon) => (
              <li key={coupon.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-[15px] font-medium text-ink-900">{coupon.code}</p>
                  <p className="text-xs text-ink-500">{coupon.description}</p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {coupon.type === "FIXED"
                      ? `${formatPoisha(coupon.value)} off`
                      : `${(coupon.value / 100).toFixed(0)}% off`}
                    {" · "}
                    {coupon.redemptionCount}/{coupon.maxRedemptions ?? "∞"} used
                    {coupon.minOrderPoisha
                      ? ` · min ${formatPoisha(coupon.minOrderPoisha)}`
                      : ""}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs ${
                      coupon.isActive && coupon.endsAt > new Date()
                        ? "border-green-200 bg-green-50 text-green-800"
                        : "border-ink-200 bg-ink-50 text-ink-600"
                    }`}
                  >
                    {coupon.isActive && coupon.endsAt > new Date() ? "active" : "inactive"}
                  </span>
                  <p className="mt-1 text-xs text-ink-500">
                    ends {coupon.endsAt.toLocaleDateString("en-GB")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4">
          <CouponCreator />
        </div>
      </section>

      {/* ---- referrals ---- */}
      <section className="card mt-6 p-5">
        <h2 className="text-sm font-semibold text-ink-900">Referral programme</h2>
        <p className="mt-1 text-sm text-ink-600">
          {referralsEnabled?.value === true || referralsEnabled?.value === "true"
            ? "Enabled. Every account already has a referral code, so codes do not need to be issued retroactively."
            : "Off. Every account has a code ready, but nothing is being rewarded until there is real supply to pay for the referrals."}
        </p>
        <p className="mt-2 text-xs text-ink-500">
          Toggle it in Settings under the growth group.
        </p>
      </section>

      {/* ---- catalogue ---- */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold text-ink-900">Catalogue</h2>
        <p className="mt-1 text-xs text-ink-500">
          {categories.length} categories, {services.length} services. Seeded from
          real Bangladesh geography and trades; not editable here so a service
          cannot be published without matching supply.
        </p>

        <div className="card mt-3 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-left text-xs text-ink-500">
                <th className="px-4 py-2 font-medium">Service</th>
                <th className="px-4 py-2 font-medium">Bangla</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 text-right font-medium">Providers</th>
              </tr>
            </thead>
            <tbody>
              {services.map((service) => (
                <tr key={service.id} className="border-b border-ink-100 last:border-0">
                  <td className="px-4 py-2 text-ink-900">{service.nameEn}</td>
                  <td lang="bn" className="px-4 py-2 text-ink-600">
                    {service.nameBn}
                  </td>
                  <td className="px-4 py-2 text-xs text-ink-500">{service.category.nameEn}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-ink-600">
                    {service._count.providerServices}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
