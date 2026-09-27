"use client";

import { useActionState } from "react";

import { updateSetting, type ActionState } from "@/app/actions/admin";
import { FormFeedback, FieldError } from "@/components/submit-button";

/**
 * Business rule editor.
 *
 * Commission rates, cancellation windows and fees live in the database so they
 * can be changed without a deploy, and every change writes an audit row with the
 * previous value. That is the whole point: a fee that changed quietly would be
 * indistinguishable from a bug.
 */
export function SettingEditor({
  settings,
}: {
  settings: Array<{ key: string; value: unknown; description: string | null; group: string }>;
}) {
  const grouped = new Map<string, typeof settings>();
  for (const setting of settings) {
    const list = grouped.get(setting.group) ?? [];
    list.push(setting);
    grouped.set(setting.group, list);
  }

  return (
    <div className="space-y-6">
      {[...grouped.entries()].map(([group, items]) => (
        <section key={group}>
          <h2 className="text-sm font-semibold capitalize text-ink-900">{group}</h2>
          <div className="mt-2 space-y-3">
            {items.map((setting) => (
              <SettingRow key={setting.key} setting={setting} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function SettingRow({
  setting,
}: {
  setting: { key: string; value: unknown; description: string | null; group: string };
}) {
  const [state, formAction, pending] = useActionState<ActionState | null, FormData>(
    updateSetting,
    null,
  );

  const asText =
    typeof setting.value === "string"
      ? setting.value
      : typeof setting.value === "object"
        ? JSON.stringify(setting.value)
        : String(setting.value);

  return (
    <form action={formAction} className="card p-4">
      <input type="hidden" name="key" value={setting.key} />
      <label className="label" htmlFor={`set-${setting.key}`}>
        {setting.description ?? setting.key}
      </label>
      <div className="flex flex-wrap items-start gap-2">
        <input
          className="input flex-1 tabular-nums"
          id={`set-${setting.key}`}
          name="value"
          defaultValue={asText}
          disabled={pending}
        />
        <button className="btn btn-secondary" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      <p className="mt-1 text-xs text-ink-400">{setting.key}</p>
      <FormFeedback state={state} />
      <FieldError message={state?.fieldErrors?.value} />
    </form>
  );
}
