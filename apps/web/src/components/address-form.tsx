"use client";

import { useActionState } from "react";

import { saveAddress, type ActionState } from "@/app/actions/customer";
import { FormFeedback, FieldError } from "@/components/submit-button";

/**
 * Address form.
 *
 * The area is a select from the real Bangladesh locality data rather than free
 * text, because service-area matching compares the address locality against a
 * provider's declared coverage. A typed-in "Banani " that differs by a space
 * would silently make a provider appear unavailable.
 */
export function AddressForm({ locations }: { locations: Array<{ id: string; label: string }> }) {
  const [state, formAction, pending] = useActionState<ActionState | null, FormData>(
    saveAddress,
    null,
  );

  if (state?.ok) {
    return (
      <div className="card animate-pop border-brand-200 bg-brand-50 p-4">
        <p className="text-sm text-brand-800">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="card space-y-4 p-5">
      <h2 className="text-sm font-semibold text-ink-900">Add an address</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="label">Label</label>
          <input
            className="input"
            id="label"
            name="label"
            required
            maxLength={40}
            placeholder="e.g. Home"
          />
          <FieldError message={state?.fieldErrors?.label} />
        </div>
        <div>
          <label className="label" htmlFor="locationId">Area</label>
          <select className="input" id="locationId" name="locationId" required>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.label}
              </option>
            ))}
          </select>
          <FieldError message={state?.fieldErrors?.locationId} />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="line1">House and road</label>
        <input
          className="input"
          id="line1"
          name="line1"
          required
          minLength={3}
          maxLength={160}
          placeholder="e.g. House 42, Road 11"
        />
        <FieldError message={state?.fieldErrors?.line1} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="areaName">Area name</label>
          <input
            className="input"
            id="areaName"
            name="areaName"
            required
            maxLength={80}
            placeholder="Banani"
          />
          <FieldError message={state?.fieldErrors?.areaName} />
        </div>
        <div>
          <label className="label" htmlFor="districtName">District</label>
          <input
            className="input"
            id="districtName"
            name="districtName"
            required
            maxLength={80}
            placeholder="Dhaka"
          />
          <FieldError message={state?.fieldErrors?.districtName} />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="landmark">Landmark (optional)</label>
        <input
          className="input"
          id="landmark"
          name="landmark"
          maxLength={160}
          placeholder="e.g. opposite the mosque"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-ink-700">
        <input type="checkbox" name="isDefault" />
        Make this my default address
      </label>

      <FormFeedback state={state} />
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save address"}
      </button>
    </form>
  );
}
