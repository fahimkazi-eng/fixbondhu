"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";

import { submitBooking, type ActionState } from "@/app/actions/customer";
import { FormFeedback, FieldError } from "@/components/submit-button";

/**
 * Booking form.
 *
 * Slot times are generated for the next seven days in the browser rather than
 * fetched, because a provider's declared weekly hours are not changing between
 * page load and submission and an extra request on a 3G connection is a
 * second of waiting a customer notices. The server re-validates the booking
 * regardless, so this is a convenience, not the check.
 */
function nextSlots(): Array<{ value: string; label: string }> {
  const slots: Array<{ value: string; label: string }> = [];
  const now = new Date();

  for (let dayOffset = 0; dayOffset < 7 && slots.length < 40; dayOffset += 1) {
    const day = new Date(now);
    day.setDate(now.getDate() + dayOffset);
    day.setHours(0, 0, 0, 0);

    // Two-hour blocks from 09:00 to 19:00, the hours local trades work.
    for (let hour = 9; hour < 19; hour += 2) {
      const start = new Date(day);
      start.setHours(hour);
      if (start.getTime() < now.getTime() + 60 * 60_000) continue;

      slots.push({
        value: start.toISOString(),
        label: `${day.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}, ${String(hour).padStart(2, "0")}:00`,
      });
    }
  }

  return slots;
}

export function BookingForm({
  providerServiceOptions,
  addresses,
  signedIn,
  providerName,
  slug,
}: {
  providerServiceOptions: Array<{ id: string; label: string; priceLabel: string }>;
  addresses: Array<{ id: string; label: string }>;
  signedIn: boolean;
  providerName: string;
  slug: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState | null, FormData>(
    submitBooking,
    null,
  );
  const slots = useMemoOnce(nextSlots);
  const [slotValue, setSlotValue] = useState(slots[0]?.value ?? "");
  const [method, setMethod] = useState<"CASH" | "BKASH">("CASH");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (state?.ok) setDone(true);
  }, [state]);

  if (!signedIn) {
    return (
      <div className="card animate-rise p-5">
        <h2 className="text-[15px] font-medium text-ink-900">Book {providerName}</h2>
        <p className="mt-1.5 text-sm text-ink-600">
          Sign in to book. You will see the exact price before anything is agreed.
        </p>
        <Link href={`/login?next=/providers/${slug}`} className="btn btn-primary mt-4 w-full">
          Sign in to book
        </Link>
      </div>
    );
  }

  if (providerServiceOptions.length === 0) {
    return (
      <div className="card p-5 text-sm text-ink-600">
        This provider has not published any bookable services.
      </div>
    );
  }

  if (done) {
    return (
      <div className="card animate-pop tone-accent p-5">
        <h2 className="text-[15px] font-medium text-brand-100">Request sent</h2>
        <p className="mt-1.5 text-sm text-brand-200">{state?.message}</p>
        <p className="mt-2 text-xs text-brand-300">
          The provider has been notified. You will see the status change on your
          bookings page.
        </p>
        <Link href="/bookings" className="btn btn-primary mt-4 w-full">
          View my bookings
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="card animate-rise p-5">
      <h2 className="text-[15px] font-medium text-ink-900">Book {providerName}</h2>

      <div className="mt-4 space-y-4">
        <div>
          <label className="label" htmlFor="providerServiceId">Service</label>
          <select
            className="input"
            id="providerServiceId"
            name="providerServiceId"
            required
            disabled={pending}
          >
            {providerServiceOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label} — {option.priceLabel}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="scheduledAt">When</label>
          <select
            className="input"
            id="scheduledAt"
            name="scheduledAt"
            required
            disabled={pending}
            value={slotValue}
            onChange={(event) => setSlotValue(event.target.value)}
          >
            {slots.length === 0 ? (
              <option value="">No slots in the next week</option>
            ) : (
              slots.map((slot) => (
                <option key={slot.value} value={slot.value}>{slot.label}</option>
              ))
            )}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="addressId">Where</label>
          {addresses.length === 0 ? (
            <div className="rounded-md border border-ink-200 bg-ink-50 p-3">
              <p className="text-sm text-ink-600">
                You have no saved address yet.
              </p>
              <Link href="/account/addresses" className="btn btn-secondary mt-2 w-full">
                Add an address
              </Link>
            </div>
          ) : (
            <select
              className="input"
              id="addressId"
              name="addressId"
              required
              disabled={pending}
            >
              {addresses.map((address) => (
                <option key={address.id} value={address.id}>{address.label}</option>
              ))}
            </select>
          )}
        </div>

        <fieldset>
          <legend className="label">Payment</legend>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: "CASH", label: "Cash on site", note: "Pay the provider directly" },
              { value: "BKASH", label: "bKash", note: "Pay online, verified by us" },
            ] as const).map((option) => (
              <label
                key={option.value}
                className={`interactive cursor-pointer rounded-lg border p-3 text-sm ${
                  method === option.value
                    ? "tone-accent"
                    : "border-ink-300 bg-ink-100"
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={option.value}
                  checked={method === option.value}
                  onChange={() => setMethod(option.value)}
                  className="sr-only"
                  disabled={pending}
                />
                <span className="block font-medium text-ink-900">{option.label}</span>
                <span className="mt-0.5 block text-xs text-ink-500">{option.note}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label className="label" htmlFor="customerNote">Note for the provider (optional)</label>
          <textarea
            className="input min-h-20 resize-y"
            id="customerNote"
            name="customerNote"
            maxLength={1000}
            placeholder="e.g. The AC is in the bedroom, 3rd floor with lift."
            disabled={pending}
          />
        </div>

        <div>
          <label className="label" htmlFor="couponCode">Coupon (optional)</label>
          <input
            className="input uppercase"
            id="couponCode"
            name="couponCode"
            maxLength={40}
            placeholder="CODE"
            disabled={pending}
          />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <FormFeedback state={state} />
        <FieldError message={state?.fieldErrors?.scheduledAt} />

        <button
          className="btn btn-primary w-full"
          type="submit"
          disabled={pending || addresses.length === 0 || slots.length === 0}
        >
          {pending ? "Sending request…" : "Request booking"}
        </button>

        <p className="text-xs leading-relaxed text-ink-500">
          Requesting does not commit you. The provider accepts or declines, and you
          are never charged without your approval.
        </p>
      </div>
    </form>
  );
}

/** Slots only need computing once per mount. */
function useMemoOnce<T>(factory: () => T): T {
  const [value] = useState(factory);
  return value;
}
