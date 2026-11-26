"use client";

import { useEffect, useState } from "react";
import { useIsAuthenticated } from "@/lib/auth/useIsAuthenticated";
import { useWebPush, type PushAskPlace } from "@/lib/push/useWebPush";
import { PUSH_PROMPT_COOLDOWN_MS, PUSH_PROMPT_LONG_COOLDOWN_MS, usePushPromptStore } from "@/stores/push-prompt-store";
import { PLATFORM_NAME } from "@/lib/config/platform";
import { track } from "@/lib/analytics";
import AppIcon from "@/app/components/pwa/AppIcon";

/**
 * Our ask before the browser's own permission dialog, styled as a system
 * permission sheet (the mental model a reader already has for this
 * question), in fixed light chrome like InstallModal. It guards the
 * browser's dialog, which most browsers show only once per site: a "Don't
 * Allow" here can be asked again after a cooldown, a "Block" there can't.
 * Allow opens the browser's dialog; either answer, or that dialog closing
 * unanswered, starts the cooldown unless notifications end up on.
 * `onDone` runs once it's answered (the welcome screen goes on into the app).
 */
export function PushAsk({ where, onDone }: { where: PushAskPlace; onDone?: () => void }) {
  const { subscribe } = useWebPush();
  const dismiss = usePushPromptStore((s) => s.dismiss);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    track("push_asked", { where });
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [where]);

  const notNow = () => {
    track("push_answered", { where, answer: "not_now" });
    dismiss();
    onDone?.();
  };

  const allow = async () => {
    track("push_answered", { where, answer: "allow" });
    setSubscribing(true);
    try {
      if (!(await subscribe(where))) dismiss();
    } catch {
      // Saving failed (push_save_failed); permission is granted, so this
      // device saves on the next load (resyncPushSubscription).
    } finally {
      setSubscribing(false);
      onDone?.();
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-[280px] overflow-hidden rounded-2xl bg-white text-center shadow-xl">
        <div className="px-5 pt-6 pb-5">
          <AppIcon size={56} className="mx-auto mb-3" />
          <p className="m-0 text-[15px] font-semibold leading-snug text-sand-950">
            &ldquo;{PLATFORM_NAME}&rdquo; Would Like to Send You Notifications
          </p>
          <p className="mt-2 mb-0 text-[13px] leading-snug text-sand-600">
            Get the passage of the day each morning, and replies to your notes.
          </p>
        </div>

        <div className="grid grid-cols-2 border-t border-sand-200">
          <button
            type="button"
            onClick={notNow}
            className="cursor-pointer border-r border-sand-200 py-3 text-[15px] text-sand-500 hover:bg-sand-75"
          >
            Don&apos;t Allow
          </button>
          <button
            type="button"
            onClick={allow}
            disabled={subscribing}
            className="cursor-pointer py-3 text-[15px] font-semibold text-brand-500 hover:bg-sand-75 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {subscribing ? "…" : "Allow"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** The cooldown before asking again: 14 days after the first no, 30 after later ones. */
export function usePushAskDue() {
  const dismissedAt = usePushPromptStore((s) => s.dismissedAt);
  const dismissCount = usePushPromptStore((s) => s.dismissCount);
  const hasHydrated = usePushPromptStore((s) => s.hasHydrated);
  useEffect(() => {
    usePushPromptStore.persist.rehydrate();
  }, []);
  const cooldownMs = dismissCount > 1 ? PUSH_PROMPT_LONG_COOLDOWN_MS : PUSH_PROMPT_COOLDOWN_MS;
  // eslint-disable-next-line react-hooks/purity
  const withinCooldown = dismissedAt !== null && Date.now() - dismissedAt < cooldownMs;
  return hasHydrated && !withinCooldown;
}

/**
 * The ask on every page of the app shell (not the reader, so it never
 * covers a book), for signed-in readers who haven't answered the browser
 * yet: "granted" leaves nothing to ask, "denied" can't be asked again.
 */
export default function PushPrompt() {
  const isAuthenticated = useIsAuthenticated();
  const { supported, permission } = useWebPush();
  const due = usePushAskDue();
  // Hidden once answered, until the next load re-reads the browser's state.
  const [answered, setAnswered] = useState(false);
  if (!isAuthenticated || !supported || permission !== "default" || !due || answered) return null;
  return <PushAsk where="app" onDone={() => setAnswered(true)} />;
}
