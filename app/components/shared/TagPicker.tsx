"use client";

import type { ReactNode } from "react";
import { AtSign, X } from "lucide-react";
import ReaderAvatar from "@/app/components/shared/ReaderAvatar";
import type { MentionCandidate } from "@/lib/community/mentionTypes";
import { comradeName } from "@/lib/reader/authorDisplay";

export type TagChip = { key: string; label: string; face: ReactNode; onRemove: () => void };

/** A row in the list, for a caller's `extra`. */
export const TAG_ROW =
  "flex w-full cursor-pointer items-center gap-2 rounded-sm border-none bg-transparent px-2 py-2 text-left text-[12px] font-semibold text-[var(--reader-text)] hover:bg-[var(--reader-surface-hover)] disabled:cursor-default disabled:hover:bg-transparent";

/** A comrade's face, for a chip. */
export const chipFace = (c: Pick<MentionCandidate, "pseudonym" | "avatar">) => <ReaderAvatar pseudonym={c.pseudonym} avatar={c.avatar} size={18} />;

/**
 * Tag comrades by name: a search field, who's tagged as removable chips,
 * then the matches (with no query, the comrades you've engaged with). The
 * group Invite (InviteMenu) and the composer's @ (ComposerMentions) both use
 * it; each brings its own `footer`. Enter tags the top match, Backspace on
 * an empty field untags the last, Escape calls `onClose`.
 */
export default function TagPicker({
  query,
  onQuery,
  chips,
  suggestions,
  onPick,
  membersTaggable,
  extra,
  footer,
  onClose,
}: {
  query: string;
  onQuery: (query: string) => void;
  chips: TagChip[];
  suggestions: MentionCandidate[];
  onPick: (c: MentionCandidate) => void;
  /** False for an invite: members are shown, marked, but can't be picked. */
  membersTaggable: boolean;
  /** One more row under the matches (Whole circle). */
  extra?: ReactNode;
  footer: ReactNode;
  onClose: () => void;
}) {
  const pickable = suggestions.filter((c) => membersTaggable || !c.role);
  return (
    <div className="flex flex-col gap-2">
      <label className="flex h-9 items-center gap-2 rounded-sm border border-[var(--reader-border)] px-2.5 text-[var(--reader-text-muted)] focus-within:border-brand-400">
        <AtSign size={14} />
        <input
          autoFocus
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && pickable[0]) {
              e.preventDefault();
              onPick(pickable[0]);
            } else if (e.key === "Backspace" && !query) {
              chips.at(-1)?.onRemove();
            } else if (e.key === "Escape") {
              e.stopPropagation();
              onClose();
            }
          }}
          placeholder="Tag comrades by name"
          className="min-w-0 flex-1 border-none bg-transparent text-[13px] font-medium text-[var(--reader-text)] outline-none placeholder:text-[var(--reader-text-subtle)]"
        />
      </label>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onRemove}
              aria-label={`Untag ${chip.label}`}
              className="flex max-w-full cursor-pointer items-center gap-1 rounded-full border-none bg-[color-mix(in_srgb,var(--color-brand-500)_12%,transparent)] py-px pr-1.5 pl-px text-[12px] font-semibold text-[var(--reader-text)]"
            >
              {chip.face}
              <span className="max-w-28 truncate pl-0.5">{chip.label}</span>
              <X size={12} className="text-[var(--reader-text-muted)]" />
            </button>
          ))}
        </div>
      )}

      {(suggestions.length > 0 || extra) && (
        <div className="flex max-h-56 flex-col overflow-y-auto">
          {suggestions.map((c) => {
            const locked = !membersTaggable && !!c.role;
            return (
              <button key={c.readerId} type="button" disabled={locked} onClick={() => onPick(c)} className={TAG_ROW}>
                <ReaderAvatar pseudonym={c.pseudonym} avatar={c.avatar} size={22} />
                <span className="truncate">{comradeName(c.pseudonym)}</span>
                {c.role && <span className="ml-auto text-[11px] font-medium text-[var(--reader-text-muted)]">Member</span>}
              </button>
            );
          })}
          {extra}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-[var(--reader-border)] pt-2">{footer}</div>
    </div>
  );
}
