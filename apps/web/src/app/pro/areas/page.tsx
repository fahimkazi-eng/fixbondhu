import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { removeServiceArea, saveServiceArea, type ActionState } from "@/app/actions/provider";
import { ActionForm, FieldError } from "@/components/action-form";

export const metadata: Metadata = { title: "Service areas", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Service areas.
 *
 * A customer can only book a provider whose declared areas include their
 * address, so this list is a commercial boundary and not a preference. The page
 * says so, because a provider who assumes "anywhere in Dhaka" is available will
 * be surprised by refused bookings.
 */
export default async function ProviderAreasPage() {
  const user = await getUser();
  if (!user?.providerProfileId) redirect("/pro/services");

  const [areas, available] = await Promise.all([
    prisma.providerServiceArea.findMany({
      where: { providerProfileId: user.providerProfileId },
      include: { location: true },
      orderBy: { location: { nameEn: "asc" } },
    }),
    prisma.location.findMany({
      where: { type: "AREA", isActive: true, parent: { type: "DISTRICT" } },
      orderBy: { nameEn: "asc" },
    }),
  ]);

  const takenIds = new Set(areas.map((a) => a.locationId));
  const addable = available.filter((l) => !takenIds.has(l.id));

  return (
    <div className="max-w-3xl">
      <h1 className="text-lg font-semibold tracking-tight text-ink-900">Service areas</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
        List the areas you can reach. A customer outside these areas cannot book
        you, so add everywhere you genuinely travel to. If you add none, you will
        be shown for every area.
      </p>

      <section className="mt-5">
        <h2 className="text-sm font-semibold text-ink-900">
          You cover ({areas.length})
        </h2>
        {areas.length === 0 ? (
          <p className="card mt-2 p-5 text-sm text-ink-600">
            No areas added. You will be shown to customers everywhere.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {areas.map((area) => (
              <li
                key={area.id}
                className="card animate-rise flex items-center justify-between gap-3 p-3"
              >
                <div>
                  <p className="text-sm font-medium text-ink-900">{area.location.nameEn}</p>
                  <p lang="bn" className="text-sm text-ink-600">
                    {area.location.nameBn}
                  </p>
                </div>
                <form action={removeServiceArea}>
                  <input type="hidden" name="areaId" value={area.id} />
                  <button className="btn btn-danger" type="submit">
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {addable.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-ink-900">Add an area</h2>
          <ActionForm
            action={saveServiceArea}
            submitLabel="Add area"
            pendingLabel="Adding…"
            className="card mt-2 space-y-4 p-5"
          >
            <div>
              <label className="label" htmlFor="locationId">Area</label>
              <select className="input" id="locationId" name="locationId" required>
                {addable.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.nameEn} — {location.nameBn}
                  </option>
                ))}
              </select>
              <FieldError />
            </div>
          </ActionForm>
        </section>
      ) : null}
    </div>
  );
}
