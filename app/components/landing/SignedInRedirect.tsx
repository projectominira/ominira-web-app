"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isSessionValid, useSessionStore } from "@/stores/session-store";

/** Runs before the landing paints: with a session saved (zustand persist's
 * "ominira-session"), the landing stays hidden (`html[data-signed-in]`)
 * while SignedInRedirect goes to Home. */
export const HIDE_WHEN_SIGNED_IN = `try{if(JSON.parse(localStorage.getItem("ominira-session")||"null")?.state?.session)document.documentElement.dataset.signedIn=""}catch(e){}`;

/** Signed in, the landing is Home. The server can't tell (the session is
 * client-only), so this does once the session store rehydrates. */
export default function SignedInRedirect() {
  const router = useRouter();
  const hydrated = useSessionStore((s) => s.hasHydrated);
  const signedIn = useSessionStore((s) => isSessionValid(s.session));
  useEffect(() => {
    if (!hydrated) return;
    if (signedIn) router.replace("/home");
    else delete document.documentElement.dataset.signedIn;
  }, [hydrated, signedIn, router]);
  return null;
}
