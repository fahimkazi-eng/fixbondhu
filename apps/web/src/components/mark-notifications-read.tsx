"use client";

import { markAllReadAction } from "./notifications-actions";

/** Marks every unread notification read. */
export function MarkNotificationsRead() {
  return (
    <form action={markAllReadAction}>
      <button className="btn btn-secondary" type="submit">
        Mark all read
      </button>
    </form>
  );
}
