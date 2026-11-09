/** A reader's book request — a `pending_materials` row with
 * submission_type = 'suggestion' (migrations/20261202_book_suggestions.sql).
 * Free text: whatever the reader typed lives in `title`; the first link in
 * it, if any, is copied to `source_url` so admins can open or import it. */
export type SuggestionStatus = "pending" | "approved" | "declined";

export type BookRequest = {
  id: string;
  text: string;
  status: SuggestionStatus;
  createdAt: string;
};

export const REQUEST_LIMITS = { text: 1000, perDay: 10 } as const;

export const REQUEST_STATUS_LABEL: Record<SuggestionStatus, string> = {
  pending: "On it",
  approved: "Added",
  declined: "Couldn't find it",
};

/** The first http(s) link in a request ("drive.google.com/…" included), or null. */
export function firstLink(text: string): string | null {
  const match = text.match(/\b(?:https?:\/\/|www\.|drive\.google\.com\/|docs\.google\.com\/)[^\s<>"']+/i);
  if (!match) return null;
  const raw = match[0].replace(/[).,;!?]+$/, "");
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}
