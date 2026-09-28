"use client";

import { useActionState, useState } from "react";

import { submitReview, type ActionState } from "@/app/actions/customer";
import { FormFeedback } from "@/components/submit-button";

/**
 * Review form.
 *
 * The rating is a radio group rather than a star widget because a radio group
 * is keyboard and screen-reader accessible for free, and this form is only
 * shown to a customer who has actually had the work done.
 */
export function ReviewForm({
  bookingId,
  providerName,
}: {
  bookingId: string;
  providerName: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState | null, FormData>(
    submitReview,
    null,
  );
  const [rating, setRating] = useState(5);

  if (state?.ok) {
    return (
      <section className="card animate-pop tone-accent p-5">
        <h2 className="text-sm font-semibold text-brand-100">Review published</h2>
        <p className="mt-1 text-sm text-brand-200">{state.message}</p>
      </section>
    );
  }

  return (
    <form action={formAction} className="card animate-rise p-5">
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="rating" value={rating} />

      <h2 className="text-sm font-semibold text-ink-900">
        How did {providerName} do?
      </h2>
      <p className="mt-1 text-xs text-ink-500">
        This review is tied to a completed booking and can only be left once.
      </p>

      <fieldset className="mt-3">
        <legend className="sr-only">Rating</legend>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((value) => (
            <label
              key={value}
              className={`interactive cursor-pointer rounded-md border px-3 py-1.5 text-sm font-medium ${
                value <= rating
                  ? "tone-accent"
                  : "border-ink-300 bg-ink-100 text-ink-500"
              }`}
            >
              <input
                type="radio"
                name="ratingChoice"
                value={value}
                checked={rating === value}
                onChange={() => setRating(value)}
                className="sr-only"
                disabled={pending}
              />
              {value}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-4 space-y-3">
        <div>
          <label className="label" htmlFor="title">Headline (optional)</label>
          <input
            className="input"
            id="title"
            name="title"
            maxLength={120}
            placeholder="e.g. Quick and tidy"
            disabled={pending}
          />
        </div>
        <div>
          <label className="label" htmlFor="body">Your review</label>
          <textarea
            className="input min-h-24 resize-y"
            id="body"
            name="body"
            required
            minLength={10}
            maxLength={2000}
            placeholder="What was the work like? Were they on time?"
            disabled={pending}
          />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <FormFeedback state={state} />
        <button className="btn btn-primary w-full" type="submit" disabled={pending}>
          {pending ? "Publishing…" : "Publish review"}
        </button>
      </div>
    </form>
  );
}
