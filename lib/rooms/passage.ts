import "server-only";

import { after } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { contentToColumns } from "@/lib/community/notes";
import { notifyReaders } from "@/lib/notifications/notify";
import { notificationSnippet } from "@/lib/notifications/snippet";
import { RangeSchema } from "@/lib/room/events";
import { localDay } from "@/lib/time/zone";
import { PASSAGE_PIN } from "./timeline";

// The passage of the day (rooms-spec §5.5): one for every reader, not a
// group's. An ordinary public note on the book (so its thread lives in the
// book room), posted by the Ominira account and made the day's by a
// daily_passages row (migrations/20261106_daily_passages.sql).

/** The zone the passage's day turns over in, for everyone. */
export const PASSAGE_ZONE = "Africa/Lagos";

/** The passage's day at `now`. */
export const passageDay = (now: number) => localDay(now, PASSAGE_ZONE);

export const PassageInput = z.object({
  materialId: z.uuid(),
  /** The quote and where it is. */
  ranges: z.array(RangeSchema).min(1).max(5),
  /** The note's own words, under the quote; usually none. */
  text: z.string().trim().max(2000).default(""),
  question: z.string().trim().min(1).max(280),
});
export type PassageInput = z.infer<typeof PassageInput>;

export type PassageOutcome = { postId: string } | "book_not_found" | "no_official_account";

/** The Ominira account(s): "Ominira" on their bubbles. */
export async function officialReaderIds(): Promise<Set<string>> {
  const { data, error } = await getSupabaseAdminClient().from("readers").select("id").eq("official", true);
  if (error) throw error;
  return new Set(data.map((r) => r.id));
}

/** The passages among a page of notes, by post id: their questions, and
 * whether each is today's. One small read, none for an empty page. */
export async function pagePassages(rows: { id: string }[], now: number): Promise<Map<string, { question: string; today: boolean }>> {
  const out = new Map<string, { question: string; today: boolean }>();
  if (rows.length === 0) return out;
  const { data, error } = await getSupabaseAdminClient()
    .from("daily_passages")
    .select("day, post_id, question")
    .in(
      "post_id",
      rows.map((r) => r.id)
    );
  if (error) throw error;
  const today = passageDay(now);
  for (const p of data) out.set(p.post_id, { question: p.question, today: p.day === today });
  return out;
}

/**
 * Sets today's passage: posts the note on the book as the Ominira account,
 * makes it the day's (a new one replaces the earlier one for the day; past
 * days stay), and tells every reader (`passage`, once a day each).
 */
export async function setPassage(input: PassageInput, setBy: string | null): Promise<PassageOutcome> {
  const admin = getSupabaseAdminClient();
  const [official, material] = await Promise.all([
    admin.from("readers").select("id").eq("official", true).limit(1).maybeSingle(),
    admin.from("materials").select("id, status, visibility").eq("id", input.materialId).maybeSingle(),
  ]);
  if (official.error) throw official.error;
  if (material.error) throw material.error;
  if (!material.data || material.data.status !== "published" || material.data.visibility !== "public") return "book_not_found";
  if (!official.data) return "no_official_account";
  const authorId = official.data.id;

  const { data: post, error } = await admin
    .from("posts")
    .insert({
      reader_id: authorId,
      material_id: input.materialId,
      ranges: input.ranges,
      thread_type: "note",
      visibility: "public",
      ...contentToColumns({ kind: "text", text: input.text }),
    })
    .select("id")
    .single();
  if (error) throw error;

  const { error: dayError } = await admin
    .from("daily_passages")
    .upsert({ day: passageDay(Date.now()), post_id: post.id, question: input.question, set_by: setBy, created_at: new Date().toISOString() });
  if (dayError) throw dayError;

  after(async () => {
    try {
      const { data: readers, error: readersError } = await admin.from("readers").select("id").eq("official", false);
      if (readersError) throw readersError;
      if (!readers.length) return;
      await notifyReaders(
        readers.map((r) => r.id),
        {
          kind: "passage",
          title: PASSAGE_PIN,
          body: notificationSnippet(input.question) ?? input.question,
          url: `/note/${post.id}`,
          tag: "passage",
          actorReaderId: authorId,
          snippet: input.question,
          // One a day per reader: replacing the day's passage doesn't push again.
          ref: "passage",
        }
      );
    } catch (err) {
      console.error("Failed to send passage", err);
    }
  });
  return { postId: post.id };
}
