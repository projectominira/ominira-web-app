// A signed-out Join (spec §6.1): the group is remembered here, the reader
// signs up or logs in, the end of auth lands on the group page
// (lib/auth/onboardingRoute.ts), and the page completes the join. Per device,
// in localStorage, so it survives the signup's email round trip in the same
// browser. Storage can throw (private mode, blocked site data); then the
// reader just taps Join again.

const KEY = "ominira:pending-group-join";

export function setPendingJoin(slug: string): void {
  try {
    localStorage.setItem(KEY, slug);
  } catch {}
}

export function pendingJoin(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearPendingJoin(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
