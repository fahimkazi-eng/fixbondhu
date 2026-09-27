import type { Metadata } from "next";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteAddress } from "@/app/actions/customer";
import { AddressForm } from "@/components/address-form";

export const metadata: Metadata = { title: "Addresses", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AddressesPage() {
  const user = await requireUser("/account/addresses");

  const [addresses, locations] = await Promise.all([
    prisma.address.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    }),
    prisma.location.findMany({
      where: { type: "AREA", isActive: true, parent: { type: "DISTRICT" } },
      orderBy: { nameEn: "asc" },
      select: { id: true, nameEn: true, nameBn: true },
    }),
  ]);

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-semibold tracking-tight text-ink-900">Addresses</h1>
      <p className="mt-1.5 text-sm text-ink-600">
        Your area decides which providers can reach you, so pick the locality
        accurately — a provider is only shown for addresses inside their coverage.
      </p>

      {addresses.length === 0 ? (
        <p className="card mt-4 p-6 text-center text-sm text-ink-600">
          No saved addresses. You need one before you can book.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {addresses.map((address) => (
            <li key={address.id} className="card animate-rise p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[15px] font-medium text-ink-900">{address.label}</p>
                    {address.isDefault ? (
                      <span className="chip border-brand-200 bg-brand-50 text-brand-800">
                        default
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-sm text-ink-700">{address.line1}</p>
                  {address.landmark ? (
                    <p className="text-sm text-ink-500">Near {address.landmark}</p>
                  ) : null}
                  <p className="mt-0.5 text-sm text-ink-500">
                    {address.areaName}, {address.districtName}
                  </p>
                </div>

                <form action={deleteAddress}>
                  <input type="hidden" name="addressId" value={address.id} />
                  <button className="btn btn-danger" type="submit">
                    Remove
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6">
        <AddressForm
          locations={locations.map((location) => ({
            id: location.id,
            label: `${location.nameEn} — ${location.nameBn}`,
          }))}
        />
      </div>
    </div>
  );
}
