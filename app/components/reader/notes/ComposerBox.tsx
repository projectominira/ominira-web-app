"use client";

import { useMemo, useState } from "react";
import type { KeyboardEvent, ReactNode, Ref } from "react";
import { SendHorizontal } from "lucide-react";
import LinkPreviewCard from "@/app/components/shared/LinkPreviewCard";
import { extractLinks } from "@/lib/community/links";

/** Enter sends only where there's a real keyboard; on a phone it's a new line. */
const hasKeyboard = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/** The chat input every note surface shares (NoteComposer): one field that
 * grows as you write, quiet `tools` and a square send on the same line, the
 * same bar as a room's (RoomField). `children` (link previews) sit
 * above the text inside the field, `footer` (errors) below it. */
export default function ComposerBox({
  value,
  onChange,
  placeholder,
  label,
  maxLength,
  autoFocus,
  inputRef,
  containerRef,
  onKeyDown,
  tools,
  canPost,
  postLabel = "Post",
  onPost,
  onCancel,
  footer,
  inside,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label?: string;
  maxLength?: number;
  autoFocus?: boolean;
  inputRef?: Ref<HTMLTextAreaElement>;
  containerRef?: Ref<HTMLDivElement>;
  /** First look at a key; true means it was handled (a mention picker). */
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => boolean;
  tools?: ReactNode;
  canPost: boolean;
  postLabel?: string;
  onPost: () => void;
  /** Present when there's something to cancel: Escape does it. */
  onCancel?: () => void;
  footer?: ReactNode;
  /** A row inside the box, under the text (the share switch), shown
   * while writing. */
  inside?: ReactNode;
  children?: ReactNode;
}) {
  const post = () => {
    if (canPost) onPost();
  };

  return (
    <div ref={containerRef} className="flex flex-col gap-1.5 text-[var(--reader-text)]">
      <div className="group/box flex flex-col gap-1 rounded-sm border border-[var(--reader-border)] bg-[var(--reader-surface)] p-1 pl-3 shadow-sm transition-colors duration-150 ease-out focus-within:border-[color-mix(in_srgb,var(--reader-text)_28%,transparent)]">
        {children}
        <div className="flex items-end gap-1">
          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (onKeyDown?.(e)) return;
              if (e.key === "Escape" && onCancel) {
                e.preventDefault();
                onCancel();
              } else if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && hasKeyboard()) {
                e.preventDefault();
                post();
              }
            }}
            rows={1}
            autoFocus={autoFocus}
            maxLength={maxLength}
            placeholder={placeholder}
            aria-label={label ?? placeholder}
            className="om-scroll field-sizing-content max-h-40 min-h-9 min-w-0 flex-1 resize-none border-none bg-transparent py-[7px] text-[15px] leading-[22px] text-[var(--reader-text)] outline-none placeholder:text-[var(--reader-text-muted)]"
          />
          {tools && <div className="flex flex-none items-center gap-0.5">{tools}</div>}
          <button
            type="button"
            onClick={post}
            disabled={!canPost}
            aria-label={postLabel}
            title={postLabel}
            className={`flex size-9 flex-none items-center justify-center rounded-sm border-none bg-transparent transition-colors duration-150 ease-out ${
              canPost ? "cursor-pointer text-[var(--reader-text)]" : "cursor-default text-[var(--reader-text-muted)]"
            }`}
          >
            <SendHorizontal size={18} strokeWidth={2} aria-hidden />
          </button>
        </div>
        {inside && (
          // Only while you're writing (see RoomField's own `below`).
          <div
            onMouseDown={(e) => e.preventDefault()}
            className={`${value ? "flex" : "hidden group-focus-within/box:flex"} mr-2 border-t border-[var(--reader-border)] pt-2 pb-1`}
          >
            {inside}
          </div>
        )}
      </div>
      {footer}
    </div>
  );
}

/** A quiet icon button for the box's tools. */
export const COMPOSER_TOOL =
  "flex h-8 min-w-8 flex-none cursor-pointer items-center justify-center gap-1.5 rounded-sm border-none bg-transparent px-2 text-[var(--reader-text-muted)] hover:bg-[var(--reader-surface-hover)] hover:text-[var(--reader-text)]";

/** A live preview per link in `text`, each dismissible for this draft —
 * the same links the posted note renders (NoteContent). */
export function ComposerLinks({ text }: { text: string }) {
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const links = useMemo(() => extractLinks(text).filter((url) => !dismissed.has(url)), [text, dismissed]);
  if (links.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {links.map((url) => (
        <LinkPreviewCard key={url} url={url} dismissible onDismiss={() => setDismissed((existing) => new Set(existing).add(url))} />
      ))}
    </div>
  );
}
