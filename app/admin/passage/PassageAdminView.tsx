"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import AdminPageHeader from "../AdminPageHeader";
import { formatTimeAgo } from "@/lib/reader/timeAgo";
import type { DayView, Page, SetView, TodayView } from "@/lib/passage/types";
import ConnectPanel from "./ConnectPanel";
import QuoteCard, { BUTTON } from "./QuoteCard";

export type Tab = "sets" | "history";

const TABS: { id: Tab; label: string }[] = [
  { id: "sets", label: "Sets" },
  { id: "history", label: "History" },
];

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** A cursor-paged list from an /api/admin/passage route: the first page
 * from the server when the page opens on its tab, else fetched when the tab
 * first opens (`open`). */
function usePaged<T>(url: string, first: Page<T> | null) {
  const [state, setState] = useState({
    items: first?.items ?? ([] as T[]),
    next: first?.nextCursor ?? null,
    loaded: !!first,
    loading: false,
    error: false,
  });
  const load = async (cursor: string | null) => {
    setState((s) => ({ ...s, loading: true, error: false }));
    try {
      const res = await fetch(cursor ? `${url}?cursor=${encodeURIComponent(cursor)}` : url);
      if (!res.ok) throw new Error();
      const page = (await res.json()) as Page<T>;
      setState((s) => ({ items: cursor ? [...s.items, ...page.items] : page.items, next: page.nextCursor, loaded: true, loading: false, error: false }));
    } catch {
      setState((s) => ({ ...s, loading: false, error: true }));
    }
  };
  return {
    ...state,
    open: () => !state.loaded && !state.loading && load(null),
    more: () => state.next && load(state.next),
    reload: () => load(null),
  };
}

function Paged<T>({ list, empty, children }: { list: ReturnType<typeof usePaged<T>>; empty: string; children: (items: T[]) => ReactNode }) {
  if (!list.loaded) {
    return (
      <p className="m-0 py-10 text-center text-sm text-[var(--reader-text-muted)]">
        {list.error ? (
          <button type="button" onClick={list.reload} className={BUTTON}>
            Couldn&rsquo;t load. Try again
          </button>
        ) : (
          "Loading…"
        )}
      </p>
    );
  }
  if (list.items.length === 0) return <p className="m-0 py-10 text-center text-sm text-[var(--reader-text-muted)]">{empty}</p>;
  return (
    <>
      {children(list.items)}
      {list.next && (
        <div className="mt-6 flex justify-center">
          <button type="button" disabled={list.loading} onClick={list.more} className={BUTTON}>
            {list.loading ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </>
  );
}

/** What members see today, in one strip above the tabs. */
function TodayStrip({ today }: { today: TodayView }) {
  return (
    <section aria-label="Today" className="mb-6 rounded-sm border border-[var(--reader-border)] bg-[var(--reader-surface)] px-4 py-3">
      <div className="mb-1 text-ui-xs tracking-eyebrow uppercase text-[var(--reader-text-subtle)]">Today&rsquo;s passage</div>
      {today ? (
        <div className="flex flex-col gap-1">
          <p className="m-0 text-[14px]/[1.4] font-semibold text-[var(--reader-text)]">{today.passage.question}</p>
          <p className="m-0 line-clamp-1 font-serif text-[13px] text-[var(--reader-text-muted)]">&ldquo;{today.passage.excerpt}&rdquo;</p>
          <p className="m-0 mt-0.5 text-ui-caption text-[var(--reader-text-muted)]">
            {today.passage.cite} · set by {today.setBy ?? "an admin"} at {new Date(today.at).toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" })} ·{" "}
            {plural(today.passage.answers, "answer")} ·{" "}
            <Link href={`/post/${today.postId}`} target="_blank" className="font-semibold text-[var(--reader-text)] hover:underline">
              Open thread
            </Link>
          </p>
        </div>
      ) : (
        <p className="m-0 text-ui-sm text-[var(--reader-text-muted)]">None set yet. Pick a quote below and choose &ldquo;Set as today&rsquo;s passage&rdquo;.</p>
      )}
    </section>
  );
}

/** A set: its header, and its quotes. Sets still holding new quotes open;
 * the rest fold to their header. */
function SetSection({ set, children }: { set: SetView; children: ReactNode }) {
  const counts = { new: 0, used: 0, dismissed: 0 };
  for (const q of set.quotes) counts[q.status]++;
  const [open, setOpen] = useState(counts.new > 0);
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <section className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="group flex cursor-pointer items-start gap-2 border-none bg-transparent p-0 py-2 text-left"
      >
        <Chevron size={16} className="mt-[2px] flex-none text-[var(--reader-text-subtle)] group-hover:text-[var(--reader-text)]" />
        <span className="min-w-0 flex-1">
          <span className="block font-serif text-[16px]/[1.3] font-semibold sm:text-[17px] text-[var(--reader-text)]">{set.title}</span>
          <span className="mt-0.5 block text-ui-caption text-[var(--reader-text-muted)]">
            {[
              formatTimeAgo(new Date(set.createdAt).getTime()),
              plural(set.quotes.length, "quote"),
              counts.new > 0 && <span key="new" className="font-semibold text-[var(--reader-accent)]">{counts.new} new</span>,
              counts.used > 0 && `${counts.used} used`,
            ]
              .filter(Boolean)
              .flatMap((part, i) => (i ? [" · ", part] : [part]))}
          </span>
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-3 pt-1 sm:ml-6">
          {set.note && <p className="m-0 max-w-prose text-ui-sm font-normal whitespace-pre-line text-[var(--reader-text)]">{set.note}</p>}
          <div className="divide-y divide-[var(--reader-border)] rounded-sm border border-[var(--reader-border)] bg-[var(--reader-bg)]">{children}</div>
        </div>
      )}
    </section>
  );
}

/** History, grouped by month: the date on the left, the passage beside it. */
function HistoryList({ items }: { items: DayView[] }) {
  const months = new Map<string, DayView[]>();
  for (const d of items) {
    const key = d.day.slice(0, 7);
    months.set(key, [...(months.get(key) ?? []), d]);
  }
  const date = (day: string, opts: Intl.DateTimeFormatOptions) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en", { ...opts, timeZone: "UTC" });
  return (
    <div className="flex flex-col gap-8">
      {[...months].map(([month, days]) => (
        <section key={month}>
          <h2 className="m-0 mb-2 text-ui-xs tracking-eyebrow uppercase text-[var(--reader-text-subtle)]">{date(`${month}-01`, { month: "long", year: "numeric" })}</h2>
          <ul className="m-0 list-none divide-y divide-[var(--reader-border)] rounded-sm border border-[var(--reader-border)] p-0">
            {days.map((d) => (
              <li key={d.day}>
                <a href={`/post/${d.postId}`} target="_blank" rel="noopener noreferrer" className="flex gap-4 px-4 py-4 no-underline hover:bg-[var(--reader-surface-hover)]">
                  <span className="flex w-10 flex-none flex-col items-center pt-0.5">
                    <span className="font-serif text-[18px]/[1] font-semibold text-[var(--reader-text)]">{date(d.day, { day: "numeric" })}</span>
                    <span className="mt-1 text-ui-xs uppercase text-[var(--reader-text-subtle)]">{date(d.day, { weekday: "short" })}</span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-[14px]/[1.4] font-semibold text-[var(--reader-text)]">{d.question}</span>
                    <span className="line-clamp-2 font-serif text-[14px]/[1.55] text-[var(--reader-text-muted)]">&ldquo;{d.quote}&rdquo;</span>
                    <span className="text-ui-caption text-[var(--reader-text-muted)]">
                      {[d.book, plural(d.answers, "answer"), d.setBy && `set by ${d.setBy}`, d.fromSet && `from ${d.fromSet}`].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** /admin/passage (passage-spec §3): finding passages. Today's passage of
 * the day on top; the sets the AI sent, and the history of past passages
 * of the day, below. */
export default function PassageAdminView({
  connectorUrl,
  tab: initialTab,
  today,
  newQuotes,
  members,
  firstSets,
  firstDays,
}: {
  connectorUrl: string | null;
  tab: Tab;
  today: TodayView;
  newQuotes: number;
  members: number;
  firstSets: Page<SetView> | null;
  firstDays: Page<DayView> | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState(initialTab);
  const sets = usePaged("/api/admin/passage/sets", firstSets);
  const days = usePaged("/api/admin/passage/days", firstDays);

  const go = (next: Tab) => {
    setTab(next);
    if (next === "sets") void sets.open();
    if (next === "history") void days.open();
    window.history.replaceState(null, "", next === "sets" ? "/admin/passage" : `/admin/passage?tab=${next}`);
  };

  const onUsed = () => {
    router.refresh();
    if (days.loaded) void days.reload();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <AdminPageHeader
        title="Passages"
        subtitle="Quotes your AI found in the library, to share or set as the passage of the day."
        actions={<ConnectPanel url={connectorUrl} />}
      />

      <TodayStrip today={today} />

      <nav className="mb-6 flex gap-1 border-b border-[var(--reader-border)]" aria-label="Passages">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => go(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={`-mb-px cursor-pointer border-0 border-b-2 border-solid bg-transparent px-3 py-2 text-[13px] font-semibold transition-colors ${
              tab === t.id ? "border-brand-500 text-[var(--reader-text)]" : "border-transparent text-[var(--reader-text-muted)] hover:text-[var(--reader-text)]"
            }`}
          >
            {t.label}
            {t.id === "sets" && newQuotes > 0 && <span className="text-[var(--reader-accent)]"> · {newQuotes} new</span>}
          </button>
        ))}
      </nav>

      {tab === "sets" && (
        <Paged list={sets} empty="No sets yet. Connect your AI to start sending.">
          {(items) => (
            <div className="flex flex-col gap-6">
              {items.map((set) => (
                <SetSection key={set.id} set={set}>
                  {set.quotes.map((q) => (
                    <QuoteCard key={q.id} quote={q} members={members} hasToday={!!today} onUsed={onUsed} />
                  ))}
                </SetSection>
              ))}
            </div>
          )}
        </Paged>
      )}

      {tab === "history" && (
        <Paged list={days} empty="No passage of the day yet.">
          {(items) => <HistoryList items={items} />}
        </Paged>
      )}
    </div>
  );
}
