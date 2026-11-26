"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Wordmark from "@/app/components/auth/Wordmark";
import SunriseMark from "@/app/components/auth/SunriseMark";
import AuthButton from "@/app/components/auth/AuthButton";
import { useProfile } from "@/lib/auth/useProfile";
import { useCompleteOnboarding } from "@/lib/auth/useCompleteOnboarding";
import { takeReturnPage } from "@/lib/auth/returnTo";
import { useWebPush } from "@/lib/push/useWebPush";
import { track } from "@/lib/analytics";
import { PushAsk } from "@/app/components/shell/PushPrompt";

export default function WelcomePage() {
  const router = useRouter();
  const { data: reader } = useProfile();
  const completeOnboarding = useCompleteOnboarding();
  const push = useWebPush();
  const [asking, setAsking] = useState(false);
  // Onboarding done: back to the page they came from (a room invite, a book), else Home.
  const go = () => completeOnboarding.mutate(undefined, { onSuccess: () => router.push(takeReturnPage() ?? "/home") });
  // The one moment every new reader passes through, so the tap that enters
  // first asks for notifications (our sheet, then the browser's dialog),
  // where the browser can show it; then goes on in.
  const enter = () => {
    track("onboarding_completed", {
      push: push.supported ? push.permission : "unsupported",
      installed: window.matchMedia("(display-mode: standalone)").matches,
    });
    if (push.supported && push.permission === "default") setAsking(true);
    else go();
  };
  const pseudonym = reader?.pseudonym;

  return (
    <>
      {asking && (
        <PushAsk
          where="welcome"
          onDone={() => {
            setAsking(false);
            go();
          }}
        />
      )}
      {/* Mobile: dark, ray-and-ripple mark up top, name-personalized greeting, full-width CTA. */}
      <div
        className="flex min-h-screen flex-col bg-sand-950 px-6 pb-10 text-white shell:hidden"
        style={{ paddingTop: "max(env(safe-area-inset-top), 1.5rem)" }}
      >
        <SunriseMark theme="dark" className="w-full" />
        <div className="flex-1">
          <h1 className="font-serif type-1 text-balance">
            You&rsquo;re in
            {pseudonym && (
              <>
                ,<br />
                {pseudonym}
              </>
            )}
            .
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-white/80">Welcome to Ominira.</p>
          <p className="mt-4 text-[15px] leading-relaxed text-white/80">
            Every reader deepens the well of our collective consciousness.
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-white/80">The movement grows with you.</p>
          <div className="mt-8 h-px w-10 bg-white/25" />
        </div>
        <AuthButton onClick={enter} disabled={completeOnboarding.isPending}>
          {completeOnboarding.isPending ? "Entering…" : "Enter Ominira"}
        </AuthButton>
      </div>

      {/* Desktop: light, centered column, book illustration anchoring the bottom. */}
      <div className="hidden min-h-screen flex-col bg-[var(--reader-bg)] px-16 py-16 shell:flex xl:px-24">
        <Wordmark />
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <h1 className="font-serif type-1 text-balance text-[var(--reader-text)]">
            You&rsquo;re in{pseudonym && `, ${pseudonym}`}.
          </h1>
          <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-[var(--reader-text-muted)]">
            Every reader deepens the well of our collective consciousness. The movement grows with you.
          </p>
          <AuthButton fullWidth={false} onClick={enter} disabled={completeOnboarding.isPending} className="mt-7 px-10">
            {completeOnboarding.isPending ? "Entering…" : "Enter Ominira"}
          </AuthButton>
          <p className="mt-4 text-sm text-[var(--reader-text-muted)]">You&rsquo;re in revolutionary company.</p>
          <SunriseMark theme="light" book className="mt-10 w-full max-w-md" />
        </div>
      </div>
    </>
  );
}
