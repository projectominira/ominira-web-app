"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import TagPicker, { chipFace } from "@/app/components/shared/TagPicker";
import { useMentionCandidates } from "@/lib/community/useMentions";
import { MAX_MENTIONS, type MentionCandidate } from "@/lib/community/mentionTypes";
import { comradeName } from "@/lib/reader/authorDisplay";
import { showToast } from "@/stores/toast-store";
import { primaryButton } from "@/app/components/groups/buttons";

/**
 * The Invite dropdown (a study group's, a reading room's): tag comrades
 * (TagPicker, members marked) and Send invite notifies each one; the
 * caller's `share` keeps the plain link. Anchored to its trigger, so it
 * fits a phone.
 */
export default function InviteDropdown({
  label = "Invite",
  icon: Icon,
  triggerClassName,
  iconSize = 15,
  className,
  align = "left",
  ariaLabel,
  groupSlug = null,
  share,
  send,
  onFail,
}: {
  label?: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  triggerClassName: string;
  iconSize?: number;
  /** The wrapper's, for a trigger that fills a row. */
  className?: string;
  /** Which edge of the trigger the dropdown lines up with. */
  align?: "left" | "right";
  ariaLabel: string;
  /** Marks this group's members in the matches. */
  groupSlug?: string | null;
  share: ReactNode;
  send: (readerIds: string[], done: { onSuccess: () => void; onError: (err: unknown) => void }) => void;
  onFail: (err: unknown) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tagged, setTagged] = useState<MentionCandidate[]>([]);
  const [pending, setPending] = useState(false);
  const { data: candidates = [] } = useMentionCandidates(open ? query : null, groupSlug);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const tag = (c: MentionCandidate) => {
    if (tagged.length >= MAX_MENTIONS) return;
    setTagged((t) => [...t, c]);
    setQuery("");
  };
  const untag = (readerId: string) => setTagged((t) => t.filter((x) => x.readerId !== readerId));
  const submit = () => {
    setPending(true);
    send(
      tagged.map((t) => t.readerId),
      {
        onSuccess: () => {
          setPending(false);
          showToast(tagged.length === 1 ? `Invite sent to ${comradeName(tagged[0].pseudonym)}` : `Invite sent to ${tagged.length} comrades`);
          setTagged([]);
          setOpen(false);
        },
        onError: (err) => {
          setPending(false);
          onFail(err);
        },
      }
    );
  };

  return (
    <div className={`relative flex flex-col ${className ?? ""}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open} className={triggerClassName}>
        <Icon size={iconSize} strokeWidth={iconSize > 15 ? 1.75 : 2} />
        {label}
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} className="fixed inset-0 z-19" />
          <div
            role="dialog"
            aria-label={ariaLabel}
            className={`reader-menu-in absolute top-[calc(100%+6px)] z-20 w-[min(340px,calc(100vw-32px))] rounded-sm border border-[var(--reader-border)] bg-[var(--reader-surface)] p-2 shadow-md ${align === "right" ? "right-0" : "left-0"}`}
          >
            <TagPicker
              query={query}
              onQuery={setQuery}
              chips={tagged.map((t) => ({ key: t.readerId, label: comradeName(t.pseudonym), face: chipFace(t), onRemove: () => untag(t.readerId) }))}
              suggestions={candidates.filter((c) => !tagged.some((t) => t.readerId === c.readerId))}
              onPick={tag}
              membersTaggable={false}
              onClose={() => setOpen(false)}
              footer={
                <>
                  {share}
                  <button type="button" onClick={submit} disabled={tagged.length === 0 || pending} className={primaryButton}>
                    Send invite
                  </button>
                </>
              }
            />
          </div>
        </>
      )}
    </div>
  );
}
