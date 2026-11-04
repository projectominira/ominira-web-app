"use client";

import { startTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import StatusPage, { statusActionClass } from "@/app/components/shared/StatusPage";

// error.message is deliberately not shown — in production Next replaces
// server errors with a generic digest string that means nothing to a reader.
// It is still logged: a client-side throw caught here never reaches Next's dev
// overlay, so the console is the only place it surfaces.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // reset() alone re-renders what's already on the client, so a page whose
  // server render failed fails again; refetch it first, in one transition.
  const router = useRouter();
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPage
      title="Something went wrong"
      action={
        <button type="button" onClick={retry} className={statusActionClass}>
          Try again
        </button>
      }
    >
      This page couldn&apos;t be loaded. It&apos;s usually temporary — try again in a moment.
    </StatusPage>
  );
}
