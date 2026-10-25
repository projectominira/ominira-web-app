/** Where you are in a book, the same wherever it shows (Home's Today card,
 * a book's Info, a group's target card, reading list and members): the chapter over the bar and
 * how much is done. */
export default function ReadingProgress({ chapter, pct, className = "" }: { chapter: string | null; pct: number; className?: string }) {
  return (
    <div className={`flex min-w-0 flex-col gap-2.5 ${className}`}>
      {chapter && <span className="truncate text-ui-caption text-[var(--color-app-text-secondary)]">{chapter}</span>}
      <div className="flex items-center gap-2">
        <span className="h-1 flex-1 overflow-hidden rounded-full bg-sand-100">
          <span style={{ width: `${pct}%` }} className="block h-full rounded-full bg-brand-500" />
        </span>
        <span className="flex-none text-ui-caption text-[var(--color-app-text-secondary)]">{pct}% complete</span>
      </div>
    </div>
  );
}
