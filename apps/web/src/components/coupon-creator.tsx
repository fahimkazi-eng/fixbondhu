"use client";

import { useActionState, useState } from "react";

import { createCoupon, type ActionState } from "@/app/actions/admin";
import { FormFeedback, FieldError } from "@/components/submit-button";

/**
 * Coupon creator.
 *
 * The value field is ambiguous in the data model — 1000 means 10% in basis
 * points for a percentage coupon and ৳1000 for a fixed one — so the form shows
 * the unit next to the input and re-labels it when the type changes, rather
 * than leaving a finance user to guess.
 */
export function CouponCreator() {
  const [state, formAction, pending] = useActionState<ActionState | null, FormData>(
    createCoupon,
    null,
  );
  const [type, setType] = useState<"PERCENT" | "FIXED">("FIXED");

  if (state?.ok) {
    return (
      <div className="card animate-pop tone-accent p-4">
        <p className="text-sm text-brand-200">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="card space-y-4 p-5">
      <div>
        <label className="label" htmlFor="code">Code</label>
        <input
          className="input uppercase"
          id="code"
          name="code"
          required
          minLength={3}
          maxLength={24}
          placeholder="LAUNCH100"
        />
        <FieldError message={state?.fieldErrors?.code} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="type">Type</label>
          <select
            className="input"
            id="type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as "PERCENT" | "FIXED")}
          >
            <option value="FIXED">Fixed amount off</option>
            <option value="PERCENT">Percentage off</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="value">
            {type === "FIXED" ? "Amount off (poisha)" : "Percentage off (basis points)"}
          </label>
          <input
            className="input tabular-nums"
            id="value"
            name="value"
            type="number"
            inputMode="numeric"
            min={1}
            required
            placeholder={type === "FIXED" ? "10000 (৳100)" : "1000 (10%)"}
          />
          <p className="mt-1 text-xs text-ink-500">
            {type === "FIXED"
              ? "Money is stored in poisha. 10000 = ৳100."
              : "Basis points: 1000 = 10%."}
          </p>
          <FieldError message={state?.fieldErrors?.value} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="minOrderPoisha">Minimum order (poisha, optional)</label>
          <input className="input tabular-nums" id="minOrderPoisha" name="minOrderPoisha" type="number" min={0} />
        </div>
        <div>
          <label className="label" htmlFor="maxDiscountPoisha">Maximum discount (poisha, optional)</label>
          <input className="input tabular-nums" id="maxDiscountPoisha" name="maxDiscountPoisha" type="number" min={0} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="startsAt">Starts</label>
          <input className="input" id="startsAt" name="startsAt" type="date" required />
        </div>
        <div>
          <label className="label" htmlFor="endsAt">Ends</label>
          <input className="input" id="endsAt" name="endsAt" type="date" required />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="maxRedemptions">Maximum uses (optional)</label>
        <input className="input tabular-nums" id="maxRedemptions" name="maxRedemptions" type="number" min={1} />
      </div>

      <div>
        <label className="label" htmlFor="description">Description (optional)</label>
        <input className="input" id="description" name="description" maxLength={200} />
      </div>

      <FormFeedback state={state} />
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create coupon"}
      </button>
    </form>
  );
}
