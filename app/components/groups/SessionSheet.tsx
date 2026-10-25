"use client";

import { useState } from "react";
import TextField from "@/app/components/auth/TextField";
import BottomSheet from "@/app/components/shared/BottomSheet";
import { DateField } from "@/app/components/shared/DatePicker";
import { errorMessage } from "@/lib/api/client";
import { repeatLabel } from "@/lib/groups/copy";
import { useCreateSession, useUpdateSession } from "@/lib/groups/hooks";
import { wallTime } from "@/lib/groups/sessions";
import { SESSION_TOPIC_MAX, type GroupSession, type SessionRepeat } from "@/lib/groups/types";
import { useNow } from "@/lib/time/useNow";
import { deviceTimeZone, localDay, zonedTime } from "@/lib/time/zone";
import { showToast } from "@/stores/toast-store";
import SheetActions from "./SheetActions";

const REPEATS: SessionRepeat[] = ["once", "weekly"];

/**
 * Schedule a session (M8): topic, day, time and Repeat. The day and time
 * are where the moderator is; the server stores the instant and a weekly
 * series keeps that time in the group's timezone. Opens on `session` to
 * edit it (a weekly one from here on).
 */
export default function SessionSheet({
  slug,
  session,
  marks,
  onClose,
}: {
  slug: string;
  session?: GroupSession;
  /** Other session days, dotted in the picker. */
  marks?: string[];
  onClose: () => void;
}) {
  const tz = deviceTimeZone();
  const now = useNow(30_000);
  const at = session ? Date.parse(session.startsAt) : null;
  const [topic, setTopic] = useState(session?.topic ?? "");
  const [day, setDay] = useState<string | null>(at ? localDay(at, tz) : null);
  const [time, setTime] = useState(at ? wallTime(at, tz) : "19:00");
  const [repeat, setRepeat] = useState<SessionRepeat>(session?.repeat ?? "weekly");
  const create = useCreateSession(slug);
  const update = useUpdateSession(slug);
  const saving = create.isPending || update.isPending;
  const error = create.error ?? update.error;

  const startsAt = day && time ? zonedTime(day, time, tz) : null;
  const valid = topic.trim().length > 0 && startsAt !== null && (startsAt > now || startsAt === at);

  const submit = () => {
    if (!valid || saving) return;
    const input = { topic: topic.trim(), startsAt: new Date(startsAt).toISOString(), repeat };
    const done = {
      onSuccess: () => {
        showToast(session ? "Session updated" : "Session scheduled");
        onClose();
      },
    };
    if (session) update.mutate({ id: session.id, input }, done);
    else create.mutate(input, done);
  };

  return (
    <BottomSheet
      title={session ? "Edit session" : "Schedule a session"}
      onClose={onClose}
      footer={
        <SheetActions
          label={saving ? "Saving…" : session ? "Save" : "Schedule session"}
          onCancel={onClose}
          onConfirm={submit}
          disabled={!valid || saving}
        />
      }
    >
      <div className="flex flex-col gap-5">
        <TextField
          label="Topic"
          name="topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          maxLength={SESSION_TOPIC_MAX}
          placeholder="The pitfalls of national consciousness"
        />

        <div className="flex gap-3">
          <div className="min-w-0 flex-[3]">
            <DateField label="Day" value={day} onChange={setDay} marks={marks} />
          </div>
          <div className="min-w-0 flex-[2]">
            <TextField label="Time" name="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
          </div>
        </div>

        <fieldset className="m-0 flex flex-col border-none p-0">
          <legend className="mb-2 p-0 text-[13px] font-bold text-[var(--reader-text)]">Repeat</legend>
          <div className="flex gap-1.5">
            {REPEATS.map((value) => {
              const on = value === repeat;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setRepeat(value)}
                  className={`h-10 flex-1 cursor-pointer rounded-sm border text-[13px] font-semibold ${
                    on
                      ? "border-brand-500 bg-[color-mix(in_srgb,var(--color-brand-500)_10%,transparent)] text-brand-500"
                      : "border-[var(--reader-border)] bg-transparent text-[var(--reader-text)]"
                  }`}
                >
                  {repeatLabel(value)}
                </button>
              );
            })}
          </div>
        </fieldset>

        <p className="m-0 text-xs text-[var(--reader-text-muted)]">
          Members get a reminder an hour before and again when you start the room.
        </p>

        {error && <p className="m-0 text-xs font-semibold text-[#f26b6b]">{errorMessage(error) ?? "Couldn't save the session. Try again."}</p>}
      </div>
    </BottomSheet>
  );
}
