import type { GroupBookStatus } from "@/lib/groups/types";

const STATUS: Record<GroupBookStatus, { label: string; className: string }> = {
  current: { label: "Reading", className: "bg-brand-500" },
  next: { label: "Up next", className: "bg-sand-950/70" },
  done: { label: "Finished", className: "bg-[var(--color-forest-500)]" },
};

/** A reading-list book's status, as a strip across the foot of its cover
 * (the cover's box is `relative`). */
export default function CoverStatus({ status }: { status: GroupBookStatus }) {
  const { label, className } = STATUS[status];
  return (
    <span className={`absolute inset-x-0 bottom-0 py-0.5 text-center text-[8px] font-bold uppercase tracking-[0.06em] text-white ${className}`}>{label}</span>
  );
}
