"use client";

import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { useIsAuthenticated } from "@/lib/auth/useIsAuthenticated";
import type { NoteVisibility } from "@/lib/api/types";
import MembersOnlyPrompt, { type MembersOnlyAction } from "./MembersOnlyPrompt";
import { ShareSwitch } from "@/app/components/rooms/RoomInput";
import ComposerBox, { ComposerLinks } from "./ComposerBox";

/** The note composer — a new note, a reply, or an edit in place, in the
 * chat input (ComposerBox). Public unless "Only you" is on. Voice notes
 * are left out for now. */
export default function NoteComposer({
  initialText,
  initialVisibility,
  placeholder = "Share a note…",
  showMemberPrompt = false,
  action = "note",
  onCancel,
  excludeRef,
  onSave,
  draftKey,
}: {
  initialText: string;
  /** Editing: the note's own visibility. A fresh note starts public. */
  initialVisibility?: NoteVisibility;
  placeholder?: string;
  /** Show the signed-out membership prompt instead of nothing. */
  showMemberPrompt?: boolean;
  action?: MembersOnlyAction;
  /** A reply or an edit: Cancel closes it, and so does a click outside
   * while there's nothing to lose. A standing composer omits it. */
  onCancel?: () => void;
  /** The trigger that opened this composer — a click on it isn't "outside". */
  excludeRef?: RefObject<HTMLElement | null>;
  onSave: (content: { kind: "text"; text: string }, visibility: NoteVisibility) => void;
  /** Keeps a fresh draft in localStorage under `ominira-note-draft-<draftKey>`. */
  draftKey?: string;
}) {
  const isAuthenticated = useIsAuthenticated();
  const storageKey = draftKey ? `ominira-note-draft-${draftKey}` : null;
  const [text, setText] = useState(() => {
    if (!initialText && storageKey && typeof window !== "undefined") {
      try {
        return window.localStorage.getItem(storageKey) ?? initialText;
      } catch {
        return initialText;
      }
    }
    return initialText;
  });
  const editing = initialVisibility !== undefined;
  const [visibility, setVisibility] = useState<NoteVisibility>(initialVisibility ?? "public");
  const onlyYou = visibility === "private";
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!storageKey) return;
    try {
      if (text) window.localStorage.setItem(storageKey, text);
      else window.localStorage.removeItem(storageKey);
    } catch {
      // Best-effort — a private-browsing quota error shouldn't block typing.
    }
  }, [storageKey, text]);

  const hasDraft = text.trim().length > 0;
  const handleSave = () => {
    if (!hasDraft) return;
    onSave({ kind: "text", text: text.trim() }, visibility);
    setText("");
  };
  const handleCancel = () => {
    if (onCancel) onCancel();
    else setText("");
  };

  // A reply or edit with nothing new typed closes on a click outside it.
  // Reply triggers mark themselves `data-note-reply-trigger` (one composer
  // is retargeted between them).
  const closesOnOutside = Boolean(onCancel) && text === initialText;
  useEffect(() => {
    if (!closesOnOutside) return;
    const onOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (excludeRef?.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-note-reply-trigger]")) return;
      onCancel?.();
    };
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [closesOnOutside, excludeRef, onCancel]);

  if (!isAuthenticated) {
    if (!showMemberPrompt) return null;
    return (
      <div ref={containerRef}>
        <MembersOnlyPrompt action={action} onClose={onCancel} />
      </div>
    );
  }

  return (
    <div ref={containerRef}>
      <ComposerBox
        value={text}
        onChange={setText}
        placeholder={onlyYou ? "A note only you will see" : placeholder}
        autoFocus={Boolean(onCancel)}
        canPost={hasDraft && (!editing || text.trim() !== initialText.trim() || visibility !== initialVisibility)}
        postLabel={editing ? "Save" : "Post"}
        onPost={handleSave}
        onCancel={onCancel || hasDraft ? handleCancel : undefined}
        inside={<ShareSwitch on={onlyYou} onChange={(on) => setVisibility(on ? "private" : "public")} />}
      >
        <ComposerLinks text={text} />
      </ComposerBox>
    </div>
  );
}
