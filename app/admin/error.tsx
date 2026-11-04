"use client";

import { startTransition } from "react";
import { useRouter } from "next/navigation";
import StatusPage, { statusActionClass } from "@/app/components/shared/StatusPage";

// Admin's own boundary — renders inside the admin chrome (hence the shorter
// height) and keeps error.message, which is useful to an admin.
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // reset() alone re-renders what's already on the client, so a page whose
  // server render failed fails again; refetch it first, in one transition.
  const router = useRouter();
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });
  return (
    <StatusPage
      title="This admin page couldn't load"
      className="min-h-[60vh]"
      action={
        <button type="button" onClick={retry} className={statusActionClass}>
          Try again
        </button>
      }
    >
      {error.message}
    </StatusPage>
  );
}
