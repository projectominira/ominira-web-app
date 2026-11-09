"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CalendarDays, History } from "lucide-react";
import AdminPageHeader from "../AdminPageHeader";
import { AdminMenu, AdminPanelHeader, AdminSidePanel } from "../AdminControls";
import { formatTimeAgo } from "@/lib/reader/timeAgo";
import { showToast } from "@/stores/toast-store";
import { quoteText, type CalendarView as Calendar, type DayView, type Page, type QuoteView, type SetView } from "@/lib/passage/types";
import QuoteCard, { BUTTON, PRIMARY, shortDay, stripMarkers } from "./QuoteCard";
import CalendarView from "./CalendarView";
import { dayLabel, KIND_LABEL } from "./DayPicker";

export type Tab = "calendar" | "review" | "history";

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;
const TH = "px-3 py-2.5 font-[inherit]";
const TD = "px-3 py-2.5 align-middle";
const ROW = "cursor-pointer border-b border-[var(--reader-border)] transition-colors last:border-b-0 hover:bg-[var(--reader-surface-hover)]";
const ACTIVE = "bg-[var(--reader-surface-hover)]";
const fullDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

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
      const res = await fetch(
        cursor ? `${url}?cursor=${encodeURIComponent(cursor)}` : url,
      );
      if (!res.ok) throw new Error();
      const page = (await res.json()) as Page<T>;
      setState((s) => ({
        items: cursor ? [...s.items, ...page.items] : page.items,
        next: page.nextCursor,
        loaded: true,
        loading: false,
        error: false,
      }));
    } catch {
      setState((s) => ({ ...s, loading: false, error: true }));
    }
  };
  return {
    ...state,
    open: () => !state.loaded && !state.loading && load(null),
    more: () => state.next && load(state.next),
    reload: () => load(null),
    update: (fn: (items: T[]) => T[]) =>
      setState((s) => ({ ...s, items: fn(s.items) })),
  };
}

function Paged<T>({
  list,
  empty,
  children,
}: {
  list: ReturnType<typeof usePaged<T>>;
  empty: string;
  children: (items: T[]) => ReactNode;
}) {
  if (!list.loaded || list.items.length === 0) {
    return (
      <div className="rounded-sm border border-[var(--reader-border)] px-5 py-10 text-center text-sm text-[var(--reader-text-muted)]">
        {!list.loaded && list.error ? (
          <button type="button" onClick={list.reload} className={BUTTON}>
            Couldn&rsquo;t load. Try again
          </button>
        ) : !list.loaded ? (
          "Loading…"
        ) : (
          empty
        )}
      </div>
    );
  }
  return (
    <>
      <div className="overflow-x-auto rounded-sm border border-[var(--reader-border)]">
        {children(list.items)}
      </div>
      {list.next && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            disabled={list.loading}
            onClick={list.more}
            className={BUTTON}
          >
            {list.loading ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </>
  );
}

function Status({ quote }: { quote: QuoteView }) {
  if (quote.status === "approved")
    return <span className="font-semibold text-brand-600">Scheduled{quote.day ? ` · ${shortDay(quote.day)}` : ""}</span>;
  if (quote.status === "used")
    return (
      <span className="font-semibold text-brand-600">
        Passage of the day{quote.usedOn ? ` · ${shortDay(quote.usedOn)}` : ""}
      </span>
    );
  if (quote.status === "dismissed")
    return <span className="text-[var(--reader-text-subtle)]">Dismissed</span>;
  if (quote.usedOn)
    return (
      <span className="text-[var(--reader-text-muted)]">
        Used {shortDay(quote.usedOn)}
      </span>
    );
  return <span className="font-semibold text-[var(--reader-accent)]">New</span>;
}

/** Fill: the quotes waiting for review, each approvable for the open day. */
function FillPanel({ day, calendar, onDone, onClose }: { day: string; calendar: Calendar; onDone: () => void; onClose: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const label = day === calendar.today ? "today" : dayLabel(day);
  const approve = async (q: QuoteView) => {
    setBusy(q.id);
    try {
      const res = await fetch(`/api/admin/passage/quotes/${q.id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q.question, day }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Please try again.");
      showToast(`Approved for ${label}.`);
      onDone();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(null);
    }
  };
  return (
    <AdminSidePanel label={`Fill ${label}`} onClose={onClose}>
      <AdminPanelHeader
        title={`Fill ${label}`}
        subtitle={day === calendar.today ? "Goes out at 07:00, or within minutes if that's passed" : `${plural(calendar.waiting.length, "quote")} to review`}
        onClose={onClose}
      />
      {calendar.waiting.length === 0 ? (
        <p className="m-0 px-5 py-8 text-center text-ui-sm text-[var(--reader-text-muted)]">
          Nothing waiting for review. Ask your AI to plan the next 30 days.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {calendar.waiting.map((q) => (
            <li key={q.id} className="flex flex-col gap-2 border-b border-[var(--reader-border)] px-5 py-4">
              <span className="text-ui-caption text-[var(--reader-text-muted)]">
                <span className="font-semibold text-[var(--reader-text)]">{KIND_LABEL[q.kind]}</span>
                {q.kind === "anniversary" && q.wantedDay && <> · {dayLabel(q.wantedDay)}</>}
                {q.occasion && <> · {q.occasion}</>}
              </span>
              <p className="m-0 line-clamp-3 font-serif text-[15px]/[1.55] text-[var(--reader-text)]">&ldquo;{stripMarkers(quoteText(q.ranges))}&rdquo;</p>
              <p className="m-0 text-ui-caption text-[var(--reader-text-muted)]">
                {q.book.title}
                {q.question && <> · {q.question}</>}
              </p>
              <div className="flex justify-end">
                <button type="button" disabled={!!busy || !q.question.trim()} onClick={() => approve(q)} className={PRIMARY}>
                  {q.question.trim() ? (busy === q.id ? "Approving…" : `Approve for ${label}`) : "Needs a question (To review)"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminSidePanel>
  );
}

/**
 * /admin/passage (passage-spec §8.4): the next 30 days, today first, and
 * the quotes the AI sent waiting for review; past passages from ⋯. A row
 * opens its quote on the right.
 */
export default function PassageAdminView({
  tab: initialTab,
  calendar,
  newQuotes,
  members,
  firstSets,
  firstDays,
}: {
  tab: Tab;
  calendar: Calendar;
  newQuotes: number;
  members: number;
  firstSets: Page<SetView> | null;
  firstDays: Page<DayView> | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState(initialTab);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filling, setFilling] = useState<string | null>(null);
  /** A quote opened from the calendar, edited in place. */
  const [calendarQuote, setCalendarQuote] = useState<QuoteView | null>(null);
  const sets = usePaged("/api/admin/passage/sets", firstSets);
  const days = usePaged("/api/admin/passage/days", firstDays);
  const close = () => {
    setOpenId(null);
    setCalendarQuote(null);
    setFilling(null);
  };
  const openQuote =
    tab === "review" && openId
      ? sets.items.flatMap((set) => set.quotes.map((quote) => ({ set, quote }))).find((x) => x.quote.id === openId)
      : undefined;
  const posted = calendar.days[0].posted;
  const openDay = tab === "history" && openId ? days.items.find((d) => d.day === openId) : openId === "today" ? posted : undefined;
  const planned = calendar.days.filter((d) => d.posted || d.quote).length;

  const go = (next: Tab) => {
    setTab(next);
    close();
    if (next === "review") void sets.open();
    if (next === "history") void days.open();
    window.history.replaceState(null, "", next === "calendar" ? "/admin/passage" : `/admin/passage?tab=${next}`);
  };

  /** The calendar comes with the page: a change reloads it, and the review
   * list when it's been opened. */
  const onScheduled = () => {
    router.refresh();
    if (sets.loaded) void sets.reload();
  };

  const onUsed = () => {
    onScheduled();
    if (days.loaded) void days.reload();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateQuote =
    (setId: string, quoteId: string) => (update: (q: QuoteView) => QuoteView) =>
      sets.update((items) =>
        items.map((s) =>
          s.id !== setId
            ? s
            : {
                ...s,
                quotes: s.quotes.map((q) => (q.id === quoteId ? update(q) : q)),
              },
        ),
      );

  return (
    <div>
      <AdminPageHeader
        title="Passages"
        subtitle={
          tab === "history"
            ? "Past passages of the day."
            : `${planned} of the next ${calendar.days.length} days planned${newQuotes > 0 ? ` · ${newQuotes} to review` : ""}`
        }
        actions={
          <AdminMenu
            items={[
              tab === "history"
                ? { label: "Calendar", icon: <CalendarDays size={14} />, onClick: () => go("calendar") }
                : { label: "Passage history", icon: <History size={14} />, onClick: () => go("history") },
            ]}
          />
        }
      />

      {tab !== "history" && (
        <div role="tablist" aria-label="Passages" className="mb-5 inline-flex h-9 overflow-hidden rounded-sm border border-sand-300 bg-[var(--reader-surface)] p-0.5">
          {(
            [
              ["calendar", `Next ${calendar.days.length} days`],
              ["review", newQuotes > 0 ? `To review ${newQuotes}` : "To review"],
            ] as const
          ).map(([t, label]) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => go(t)}
              className={`cursor-pointer rounded-[3px] border-none px-3 text-[13px] font-semibold transition-colors ${
                tab === t ? "bg-[var(--reader-surface-hover)] text-[var(--reader-text)]" : "bg-transparent text-[var(--reader-text-muted)] hover:text-[var(--reader-text)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {tab === "calendar" && (
        <CalendarView
          calendar={calendar}
          onOpenQuote={(q) => {
            close();
            setCalendarQuote(q);
          }}
          onOpenPosted={() => {
            close();
            setOpenId("today");
          }}
          onFill={(day) => {
            close();
            setFilling(day);
          }}
          onChanged={onScheduled}
        />
      )}

      {tab === "review" && (
        <Paged
          list={sets}
          empty="No quotes yet. Connect your AI to start sending."
        >
          {(items) => (
            <table className="w-full min-w-[720px] border-collapse text-left text-[12px]">
              <thead>
                <tr className="border-b border-[var(--reader-border)] text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--reader-text-subtle)]">
                  <th className={TH}>Quote</th>
                  <th className={TH}>Book</th>
                  <th className={TH}>Kind</th>
                  <th className={TH}>Set</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Added</th>
                </tr>
              </thead>
              <tbody>
                {items.map((set) =>
                  set.quotes.map((q) => (
                    <tr
                      key={q.id}
                      onClick={() => setOpenId(q.id)}
                      className={`${ROW} ${openId === q.id ? ACTIVE : ""}`}
                    >
                      <td
                        className={`${TD} max-w-[300px] truncate font-semibold ${q.status === "dismissed" ? "text-[var(--reader-text-subtle)] line-through" : "text-[var(--reader-text)]"}`}
                      >
                        &ldquo;{stripMarkers(quoteText(q.ranges))}&rdquo;
                      </td>
                      <td className={`${TD} max-w-[180px] truncate text-[var(--reader-text-muted)]`}>{q.book.title}</td>
                      <td className={`${TD} whitespace-nowrap text-[var(--reader-text-muted)]`} title={q.occasion || undefined}>
                        {KIND_LABEL[q.kind]}
                      </td>
                      <td className={`${TD} max-w-[160px] truncate text-[var(--reader-text-muted)]`}>{set.title}</td>
                      <td className={`${TD} whitespace-nowrap`}>
                        <Status quote={q} />
                      </td>
                      <td className={`${TD} whitespace-nowrap text-[var(--reader-text-muted)]`}>
                        {formatTimeAgo(new Date(set.createdAt).getTime())}
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          )}
        </Paged>
      )}

      {tab === "history" && (
        <Paged list={days} empty="No passage of the day yet.">
          {(items) => (
            <table className="w-full min-w-[720px] border-collapse text-left text-[12px]">
              <thead>
                <tr className="border-b border-[var(--reader-border)] text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--reader-text-subtle)]">
                  <th className={TH}>Day</th>
                  <th className={TH}>Question</th>
                  <th className={TH}>Book</th>
                  <th className={`${TH} text-right`}>Answers</th>
                  <th className={TH}>Set by</th>
                </tr>
              </thead>
              <tbody>
                {items.map((d) => (
                  <tr key={d.day} onClick={() => setOpenId(d.day)} className={`${ROW} ${openId === d.day ? ACTIVE : ""}`}>
                    <td className={`${TD} whitespace-nowrap font-semibold text-[var(--reader-text)]`}>{fullDay(d.day)}</td>
                    <td className={`${TD} max-w-[340px] truncate text-[var(--reader-text)]`}>{d.question}</td>
                    <td className={`${TD} max-w-[200px] truncate text-[var(--reader-text-muted)]`}>{d.book ?? "—"}</td>
                    <td className={`${TD} text-right tabular-nums text-[var(--reader-text-muted)]`}>{d.answers}</td>
                    <td className={`${TD} max-w-[160px] truncate text-[var(--reader-text-muted)]`}>{d.setBy ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Paged>
      )}

      {openQuote && (
        <AdminSidePanel label="Quote" onClose={close}>
          <AdminPanelHeader title={openQuote.quote.book.title} subtitle={openQuote.set.title} onClose={close} />
          <div className="flex flex-col gap-4 px-5 py-5">
            {openQuote.set.note && (
              <p className="m-0 text-ui-sm whitespace-pre-line text-[var(--reader-text-muted)]">{openQuote.set.note}</p>
            )}
            <QuoteCard
              key={openQuote.quote.id}
              quote={openQuote.quote}
              onChange={updateQuote(openQuote.set.id, openQuote.quote.id)}
              members={members}
              calendar={calendar}
              onUsed={onUsed}
              onScheduled={onScheduled}
            />
          </div>
        </AdminSidePanel>
      )}

      {calendarQuote && (
        <AdminSidePanel label="Quote" onClose={close}>
          <AdminPanelHeader
            title={calendarQuote.day ? (calendarQuote.day === calendar.today ? "Today" : fullDay(calendarQuote.day)) : calendarQuote.book.title}
            subtitle={calendarQuote.book.title}
            onClose={close}
          />
          <div className="px-5 py-5">
            <QuoteCard
              key={calendarQuote.id}
              quote={calendarQuote}
              onChange={(update) => {
                setCalendarQuote((q) => (q ? update(q) : q));
                onScheduled();
              }}
              members={members}
              calendar={calendar}
              onUsed={() => {
                close();
                onUsed();
              }}
              onScheduled={onScheduled}
            />
          </div>
        </AdminSidePanel>
      )}

      {filling && (
        <FillPanel
          day={filling}
          calendar={calendar}
          onDone={() => {
            close();
            onScheduled();
          }}
          onClose={close}
        />
      )}

      {openDay && (
        <AdminSidePanel label="Passage of the day" onClose={close}>
          <AdminPanelHeader title={fullDay(openDay.day)} subtitle={openDay.setBy ? `Set by ${openDay.setBy}` : undefined} onClose={close} />
          <div className="flex flex-col gap-3 px-5 py-5">
            <p className="m-0 text-[13px]/[1.4] font-semibold text-[var(--reader-text)]">{openDay.question}</p>
            <blockquote className="m-0 border-l-2 border-brand-400 pl-3 font-serif text-[15px]/[1.6] text-pretty sm:text-[16px]/[1.65] text-[var(--reader-text)]">
              &ldquo;{openDay.quote}&rdquo;
            </blockquote>
            <p className="m-0 text-ui-caption text-[var(--reader-text-muted)]">
              {[openDay.book, plural(openDay.answers, "answer"), openDay.fromSet && `from ${openDay.fromSet}`].filter(Boolean).join(" · ")}
            </p>
            <div>
              <a href={`/note/${openDay.postId}`} target="_blank" rel="noopener noreferrer" className={BUTTON}>
                <ArrowUpRight size={14} /> Open thread
              </a>
            </div>
          </div>
        </AdminSidePanel>
      )}
    </div>
  );
}
