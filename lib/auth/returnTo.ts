// Back to where you were once you're signed in: the last page you opened
// before auth (a room invite, a book, your account), for this tab. Every
// page but auth's and admin's is remembered as you go (ReturnTracker), so
// no sign-in link needs to carry a `?next=`; onboardingRoute sends an
// active reader there instead of Home, once.

const KEY = "ominira-return-to";

/** Pages never returned to: the auth flow itself, and admin (its own PIN). */
export const isReturnable = (path: string) => path.startsWith("/") && !path.startsWith("//") && !/^\/(auth|admin)(\/|$|\?)/.test(path);

export function rememberPage(path: string) {
  if (!isReturnable(path)) return;
  try {
    sessionStorage.setItem(KEY, path);
  } catch {}
}

/** The remembered page, cleared as it's used; null with none (or none
 * readable), so the caller falls back to Home. */
export function takeReturnPage(): string | null {
  try {
    const path = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return path && isReturnable(path) ? path : null;
  } catch {
    return null;
  }
}
