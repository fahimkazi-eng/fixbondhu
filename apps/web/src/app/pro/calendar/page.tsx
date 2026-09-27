import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { saveAvailability, type ActionState } from "@/app/actions/provider";
import { ActionForm, FieldError } from "@/components/action-form";

export const metadata: Metadata = { title: "Availability", robots: { index: false } };
export const dynamic = "force-dynamic";

const WEEKDAYS = [
  { value: 0, en: "Sunday", bn: "রবিবার" },
  { value: 1, en: "Monday", bn: "সোমবার" },
  { value: 2, en: "Tuesday", bn: "মঙ্গলবার" },
  { value: 3, en: "Wednesday", bn: "বুধবার" },
  { value: 4, en: "Thursday", bn: "বৃহস্পতিবার" },
  { value: 5, en: "Friday", bn: "শুক্রবার" },
  { value: 6, en: "Saturday", bn: "শনিবার" },
];

/** Working hours, stored as minutes from midnight so no timezone is implied. */
function toMinutes(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default async function ProviderCalendarPage() {
  const user = await getUser();
  if (!user?.providerProfileId) redirect("/pro/services");

  const windows = await prisma.providerAvailability.findMany({
    where: { providerProfileId: user.providerProfileId, isActive: true },
    orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
  });

  const byDay = new Map<number, Array<{ startMinute: number; endMinute: number }>>();
  for (const window of windows) {
    const list = byDay.get(window.weekday) ?? [];
    list.push({ startMinute: window.startMinute, endMinute: window.endMinute });
    byDay.set(window.weekday, list);
  }

  const hours = Array.from({ length: 25 }, (_, h) => h);

  return (
    <div className="max-w-3xl">
      <h1 className="text-lg font-semibold tracking-tight text-ink-900">
        Working hours
      </h1>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
        These are the hours customers can book you. Friday and Saturday are the
        busiest days for local services, so setting them accurately directly
        affects how many requests you receive.
      </p>

      <section className="mt-5">
        <h2 className="text-sm font-semibold text-ink-900">Your week</h2>
        <ul className="mt-2 space-y-2">
          {WEEKDAYS.map((day) => {
            const slots = byDay.get(day.value) ?? [];
            return (
              <li
                key={day.value}
                className={`card flex flex-wrap items-center justify-between gap-3 p-3 ${
                  slots.length === 0 ? "opacity-70" : ""
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-ink-900">{day.en}</p>
                  <p lang="bn" className="text-sm text-ink-600">
                    {day.bn}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {slots.length === 0 ? (
                    <span className="chip">Not working</span>
                  ) : (
                    slots.map((slot) => (
                      <span key={`${slot.startMinute}-${slot.endMinute}`} className="chip tabular-nums">
                        {toMinutes(slot.startMinute)} – {toMinutes(slot.endMinute)}
                      </span>
                    ))
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-ink-900">Add hours</h2>
        <ActionForm
          action={saveAvailability}
          submitLabel="Save hours"
          pendingLabel="Saving…"
          className="card mt-2 space-y-4 p-5"
        >
          <div>
            <label className="label" htmlFor="weekday">Day</label>
            <select className="input" id="weekday" name="weekday" required>
              {WEEKDAYS.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.en} ({day.bn})
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="startHour">From</label>
              <select className="input" id="startHour" name="startHour" required defaultValue={9}>
                {hours.slice(0, 24).map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="endHour">Until</label>
              <select className="input" id="endHour" name="endHour" required defaultValue={19}>
                {hours.slice(1).map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </div>
          </div>
          <FieldError />
        </ActionForm>
      </section>
    </div>
  );
}
