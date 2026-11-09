import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";

/** What the connector changed (migrations/20261205_connector_activity.sql),
 * for the Connector page's history. */
export type ConnectorActivity =
  | { id: string; at: string; kind: "tags"; books: { title: string; slug: string; categories: string[] }[]; created: string[] }
  | { id: string; at: string; kind: "passages"; setId: string; title: string; saved: number }
  | { id: string; at: string; kind: "edits"; books: BookEdit[] }
  | { id: string; at: string; kind: "categories"; changes: CategoryChange[] };

/** A book's changed fields, before and after. */
export type BookEdit = { slug: string; title: string; changes: { field: string; from: string | null; to: string | null }[] };
/** `to` null: removed; an existing name: merged into it. */
export type CategoryChange = { from: string; to: string | null; merged: boolean; books: number };

const db = () => getSupabaseAdminClient();

/** Logging never fails the tool call it describes. */
async function quietly(what: string, run: () => PromiseLike<{ error: unknown }>) {
  try {
    const { error } = await run();
    if (error) throw error;
  } catch (err) {
    console.error(`[connector activity] ${what}`, err instanceof Error ? err : JSON.stringify(err));
  }
}

export const logTags = (books: { title: string; slug: string; categories: string[] }[], created: string[]) =>
  quietly("tags", () => db().from("connector_activity").insert({ kind: "tags", detail: { books, created } }));

export const logPassages = (setId: string, title: string, saved: number) =>
  quietly("passages", () => db().from("connector_activity").insert({ kind: "passages", detail: { set_id: setId, title, saved } }));

export const logEdits = (books: BookEdit[]) => quietly("edits", () => db().from("connector_activity").insert({ kind: "edits", detail: { books } }));

export const logCategories = (changes: CategoryChange[]) =>
  quietly("categories", () => db().from("connector_activity").insert({ kind: "categories", detail: { changes } }));

export const markSeen = () => quietly("seen", () => db().from("connector_status").upsert({ id: 1, last_seen_at: new Date().toISOString() }));

/** The latest changes, and when an app last connected (null: never). */
export async function getConnectorHistory(limit = 30): Promise<{ lastSeenAt: string | null; items: ConnectorActivity[] }> {
  const [status, rows] = await Promise.all([
    db().from("connector_status").select("last_seen_at").eq("id", 1).maybeSingle(),
    db().from("connector_activity").select("id, created_at, kind, detail").order("created_at", { ascending: false }).limit(limit),
  ]);
  if (status.error) throw status.error;
  if (rows.error) throw rows.error;
  const items = rows.data.map((r): ConnectorActivity => {
    const d = r.detail as Record<string, unknown>;
    const base = { id: r.id, at: r.created_at };
    switch (r.kind) {
      case "tags":
        return { ...base, kind: "tags", books: (d.books ?? []) as never, created: (d.created ?? []) as string[] };
      case "edits":
        return { ...base, kind: "edits", books: (d.books ?? []) as never };
      case "categories":
        return { ...base, kind: "categories", changes: (d.changes ?? []) as never };
      default:
        return { ...base, kind: "passages", setId: String(d.set_id), title: String(d.title ?? ""), saved: Number(d.saved ?? 0) };
    }
  });
  // Activity predates the first "seen" on links set up before this existed.
  const lastSeenAt = [status.data?.last_seen_at, items[0]?.at].filter(Boolean).sort().at(-1) ?? null;
  return { lastSeenAt, items };
}
