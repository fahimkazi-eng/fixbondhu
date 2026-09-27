import Link from "next/link";
import type { Metadata } from "next";

import { formatPoisha, formatPoishaRange } from "@fixbondhu/core";

import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import {
  saveProviderService,
  startProviderOnboarding,
  type ActionState,
} from "@/app/actions/provider";
import { ActionForm, FieldError } from "@/components/action-form";

export const metadata: Metadata = { title: "Services & pricing", robots: { index: false } };
export const dynamic = "force-dynamic";

const PRICE_MODE_NOTES: Record<string, string> = {
  FIXED: "One agreed price. The customer sees exactly what they will pay.",
  RANGE: "An estimate band. The final figure is agreed before work starts.",
  NEGOTIABLE: "No published price. You and the customer agree on site.",
};

/**
 * Services and pricing.
 *
 * A provider cannot be dispatched for a service they have not published with a
 * price, so this screen is the gate between a profile existing and a profile
 * being bookable.
 */
export default async function ProviderServicesPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/pro/services");

  // Onboarding for a signed-in customer who wants to start providing.
  if (!user.providerProfileId) {
    return (
      <div className="max-w-lg">
        <h1 className="text-lg font-semibold tracking-tight text-ink-900">
          Start providing services
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
          Create a provider profile first. You will then add the services you
          offer, the areas you cover, and submit your details for verification.
        </p>
        <ActionForm
          action={startProviderOnboarding}
          submitLabel="Create profile"
          pendingLabel="Creating…"
          className="card mt-5 space-y-4 p-5"
        >
          <div>
            <label className="label" htmlFor="displayName">
              Your name or business name
            </label>
            <input
              className="input"
              id="displayName"
              name="displayName"
              required
              minLength={2}
              maxLength={80}
              placeholder="e.g. Rafiqul Islam"
            />
            <FieldError />
          </div>
        </ActionForm>
      </div>
    );
  }

  const [offered, catalogue] = await Promise.all([
    prisma.providerService.findMany({
      where: { providerProfileId: user.providerProfileId },
      include: { service: { include: { category: true } } },
      orderBy: { service: { nameEn: "asc" } },
    }),
    prisma.service.findMany({
      where: { isActive: true, isPublished: true },
      include: { category: true },
      orderBy: [{ category: { sequence: "asc" } }, { sequence: "asc" }],
    }),
  ]);

  const offeredIds = new Set(offered.map((s) => s.serviceId));
  const available = catalogue.filter((s) => !offeredIds.has(s.id));

  return (
    <div className="max-w-3xl">
      <h1 className="text-lg font-semibold tracking-tight text-ink-900">
        Services &amp; pricing
      </h1>
      <p className="mt-1 text-sm text-ink-600">
        You can only be booked for services listed here. Prices are in taka.
      </p>

      {/* ---- what you already offer ---- */}
      <section className="mt-5">
        <h2 className="text-sm font-semibold text-ink-900">
          Your services ({offered.length})
        </h2>

        {offered.length === 0 ? (
          <p className="card mt-2 p-5 text-sm text-ink-600">
            You have not published any services yet, so customers cannot book you.
            Add at least one below.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {offered.map((entry) => (
              <li key={entry.id} className="card animate-rise flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-ink-900">
                    {entry.service.nameEn}
                  </p>
                  <p lang="bn" className="mt-0.5 text-sm text-ink-600">
                    {entry.service.nameBn}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {entry.service.category.nameEn}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium tabular-nums text-ink-900">
                    {entry.priceMode === "FIXED"
                      ? formatPoisha(entry.minPricePoisha)
                      : entry.priceMode === "RANGE"
                        ? formatPoishaRange(entry.minPricePoisha, entry.maxPricePoisha)
                        : "Negotiable"}
                  </p>
                  <p className="text-xs text-ink-500">
                    {entry.isActive ? "Live" : "Hidden"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- add a service ---- */}
      {available.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-ink-900">Add a service</h2>
          <ActionForm
            action={saveProviderService}
            submitLabel="Add service"
            pendingLabel="Adding…"
            className="card mt-2 space-y-4 p-5"
          >
            <div>
              <label className="label" htmlFor="serviceId">Service</label>
              <select className="input" id="serviceId" name="serviceId" required>
                {available.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.category.nameEn} — {service.nameEn}
                  </option>
                ))}
              </select>
            </div>

            <fieldset>
              <legend className="label">How do you price it?</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {(["FIXED", "RANGE", "NEGOTIABLE"] as const).map((mode) => (
                  <label
                    key={mode}
                    className="interactive cursor-pointer rounded-lg border border-ink-200 p-3 text-sm"
                  >
                    <input
                      type="radio"
                      name="priceMode"
                      value={mode}
                      defaultChecked={mode === "FIXED"}
                      className="sr-only"
                    />
                    <span className="block font-medium text-ink-900">
                      {mode === "FIXED" ? "Fixed" : mode === "RANGE" ? "Range" : "Negotiable"}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">
                      {PRICE_MODE_NOTES[mode]}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="minPricePoisha">Minimum price (BDT)</label>
                <input
                  className="input tabular-nums"
                  id="minPricePoisha"
                  name="minPricePoisha"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  required
                  placeholder="600"
                />
                <FieldError />
              </div>
              <div>
                <label className="label" htmlFor="maxPricePoisha">Maximum price (BDT)</label>
                <input
                  className="input tabular-nums"
                  id="maxPricePoisha"
                  name="maxPricePoisha"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  required
                  placeholder="1200"
                />
                <FieldError />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="minDurationMinutes">Typical duration (minutes)</label>
              <input
                className="input tabular-nums"
                id="minDurationMinutes"
                name="minDurationMinutes"
                type="number"
                inputMode="numeric"
                min={15}
                max={1440}
                defaultValue={60}
                required
              />
              <p className="mt-1.5 text-xs text-ink-500">
                Used to check the provider is not double-booked.
              </p>
            </div>

            <div>
              <label className="label" htmlFor="scopeNote">What is included? (optional)</label>
              <input
                className="input"
                id="scopeNote"
                name="scopeNote"
                maxLength={200}
                placeholder="e.g. Split and window units up to 1.5 ton"
              />
            </div>
          </ActionForm>
        </section>
      ) : (
        <p className="card mt-8 p-5 text-sm text-ink-600">
          You offer every service in the catalogue that is open to providers.
        </p>
      )}
    </div>
  );
}
