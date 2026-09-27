"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Revokes the server session, then returns the user to the home page. */
export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    if (pending) return;
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      className="btn btn-secondary"
      onClick={signOut}
      disabled={pending}
      type="button"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
