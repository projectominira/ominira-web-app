import type { ReactNode } from "react";
import { SidePanel } from "./RoomScreen";
import { X } from "lucide-react";
import BottomSheet from "@/app/components/shared/BottomSheet";

/** What a room has open (a thread, Group info, the team's sheets),
 * rendered for the layout it lands in. */
export type RoomOverlay = { render: (layout: "sheet" | "panel") => ReactNode; onClose: () => void };

/** A room with what it has open: a sheet over it on mobile, a 400 px
 * column beside it on desktop (9a / 9b), so one component is mounted
 * either way. */
export function RoomFrame({ wide, overlay, children }: { wide: boolean; overlay: RoomOverlay | null; children: ReactNode }) {
  return (
    <div className="relative flex h-full min-h-0">
      {children}
      {overlay &&
        (wide ? (
          <SidePanel>
            <aside className="flex w-100 flex-none flex-col border-l border-[var(--color-app-border)] bg-[var(--reader-bg)]">{overlay.render("panel")}</aside>
          </SidePanel>
        ) : (
          <BottomSheet bare contained onClose={overlay.onClose}>
            {overlay.render("sheet")}
          </BottomSheet>
        ))}
    </div>
  );
}

/** The surface everything a room opens on demand sits on (rooms-spec §2,
 * sheet #c2, #c6): a sheet over the room on mobile (handle, rounded top),
 * a panel beside the stream on desktop. Title and sub over a hairline, the
 * body, and an optional footer (a reply input). The sheet's backdrop and
 * focus come from `BottomSheet` (`bare`); the panel's place from the room. */
export default function RoomPanel({
  layout,
  title,
  sub,
  onClose,
  actions,
  footer,
  className = "",
  children,
}: {
  layout: "sheet" | "panel";
  title: string;
  sub?: string | null;
  onClose?: () => void;
  /** Icon buttons beside Close (Book info's Share and Save). */
  actions?: ReactNode;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const sheet = layout === "sheet";
  return (
    <div className={`flex flex-col overflow-hidden bg-[var(--reader-bg)] text-[var(--color-app-text)] ${sheet ? "rounded-t-lg shadow-lg" : ""} ${className}`}>
      {sheet && (
        <div className="flex flex-none justify-center pt-2">
          <span className="h-1 w-9 rounded-full bg-sand-300" />
        </div>
      )}
      <div className={`flex flex-none items-center gap-2 border-b border-[var(--color-app-border)] ${sheet ? "py-1 pr-2 pl-4" : "min-h-16 pr-2 pl-5"}`}>
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="text-[14px] font-bold">{title}</span>
          {sub && <span className="truncate text-ui-caption text-[var(--color-app-text-muted)]">{sub}</span>}
        </div>
        {actions}
        <button type="button" aria-label="Close" onClick={onClose} className="flex size-11 flex-none cursor-pointer items-center justify-center rounded-md hover:bg-[var(--color-app-surface-muted)]">
          <X size={20} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      {children}
      {footer}
    </div>
  );
}
