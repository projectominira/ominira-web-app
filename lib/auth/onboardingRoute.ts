import type { ReaderProfile } from "@/lib/api/types";
import { takeReturnPage } from "./returnTo";

/** Where signup/login route a reader immediately after — mirrors
 * `onboardingStatus`'s own linear progression (api-spec.md § Shared Types).
 * Shared by both flows since login can just as easily land a reader
 * mid-onboarding (they signed up, then closed the tab before finishing the
 * survey) as signup always does. An active reader goes back to the page
 * they were on before auth (lib/auth/returnTo), else Home. */
export function onboardingRoute(reader: ReaderProfile): string {
  switch (reader.onboardingStatus) {
    case "pending_survey":
      return "/auth/survey";
    case "pending_welcome":
      return "/auth/welcome";
    case "active":
      return takeReturnPage() ?? "/home";
  }
}
