// Opaque cursor codec shared by every cursor-paginated list endpoint
// (api-spec.md's Conventions: "cursor is an opaque token"). Generic over the
// encoded shape — most lists key on {createdAt, id} (see Keyset/
// keysetBeforeFilter below), but a couple (the "top"/"trending" community
// feed sorts) need extra fields in their keyset, so the codec itself doesn't
// hardcode one shape. Callers only ever pass back what they were given,
// never construct one by hand.
export function encodeCursor<T>(value: T): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function decodeCursor<T>(cursor: string | null): T | null {
  if (!cursor) return null;
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf-8")) as T;
  } catch {
    // malformed/tampered cursor — treat as "no cursor" rather than erroring
    return null;
  }
}

export type Keyset = { createdAt: string; id: string };

export type AlphabeticalKeyset = { title: string; id: string };

/** The `.or(...)` fragment for "strictly before this (created_at, id) pair,
 * both descending" — the plain recency-ordered case every `recent`-sorted
 * list below uses. `column` names the time column when it isn't
 * created_at (a room's started_at / ended_at in a room's stream). */
export function keysetBeforeFilter(cursor: Keyset, column = "created_at"): string {
  return `${column}.lt.${cursor.createdAt},and(${column}.eq.${cursor.createdAt},id.lt.${cursor.id})`;
}

/** The `.or(...)` fragment for "strictly after this (title, id) pair,
 * both ascending" — the alphabetical browse case. */
export function keysetAfterAlphabeticalFilter(cursor: AlphabeticalKeyset): string {
  return `title.gt.${cursor.title},and(title.eq.${cursor.title},id.gt.${cursor.id})`;
}
