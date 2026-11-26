"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, Megaphone } from "lucide-react";
import TextField from "@/app/components/auth/TextField";
import TextAreaField from "@/app/components/auth/TextAreaField";
import AppIcon from "@/app/components/pwa/AppIcon";
import type { BroadcastAudience } from "@/lib/broadcast/queue";
import { shortDay, shortDayTime } from "@/lib/time/adminFormat";
import DestinationPicker, { DEFAULT_DESTINATION, destinationFromUrl, destinationUrl, isDestinationValid, type Destination, type ListOption } from "./DestinationPicker";

type Channel = "push" | "email";
type Reuse = { title: string; body: string; url: string; channels: Channel[]; audience: "everyone" | "opted_in"; reading_list_id: string | null };

// Mirrors BroadcastInput in lib/broadcast/queue.ts.
const TITLE_MAX = 120;
const BODY_MAX = 500;
const TEST_EMAIL_KEY = "ominira-admin-test-email";
const EMAIL_WIDTH = 620;

const primary =
  "inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-sm border-none bg-brand-500 px-4 text-[13px] font-bold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50";
const secondary =
  "inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-sm border border-[var(--reader-border)] bg-transparent px-4 text-[13px] font-bold text-[var(--reader-text)] transition-colors hover:bg-[var(--reader-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50";
const card = "rounded-sm border border-[var(--reader-border)] p-5";
const h2 = "m-0 text-[14px] font-bold text-[var(--reader-text)]";
const label = "mb-2 text-[13px] font-bold text-[var(--reader-text)]";

const n = (count: number) => count.toLocaleString("en");
const month = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });
const dayLabel = (day: string) => shortDay(new Date(`${day}T12:00:00Z`));
/** Today in Lagos (UTC+1 all year), as YYYY-MM-DD. */
const lagosToday = () => new Date(Date.now() + 3600_000).toISOString().slice(0, 10);
const addDay = (day: string, days: number) => new Date(Date.parse(`${day}T12:00:00Z`) + days * 86400_000).toISOString().slice(0, 10);

/** How the emails spread over the days at the daily limit, after what's
 * already queued and sent today. Days as Resend counts them (UTC). */
function emailDays(count: number, start: Date, a: BroadcastAudience): { day: string; count: number }[] {
  if (count === 0) return [];
  const today = new Date().toISOString().slice(0, 10);
  let day = start.toISOString().slice(0, 10);
  let ahead = a.queued;
  let room = Math.max(0, a.dailyLimit - (day === today ? a.sentToday : 0));
  const days: { day: string; count: number }[] = [];
  for (let left = count; left > 0 && days.length < 60; ) {
    const theirs = Math.min(ahead, room);
    ahead -= theirs;
    const ours = Math.min(left, room - theirs);
    if (ours > 0) days.push({ day, count: ours });
    left -= ours;
    day = addDay(day, 1);
    room = a.dailyLimit;
  }
  return days;
}

/** /admin/push: compose a broadcast, preview it, then send or schedule it
 * behind the send PIN. */
export default function ComposeView({ audience, lists, emailEnabled, reuse }: { audience: BroadcastAudience; lists: ListOption[]; emailEnabled: boolean; reuse: Reuse | null }) {
  const router = useRouter();
  const [title, setTitle] = useState(reuse?.title ?? "");
  const [body, setBody] = useState(reuse?.body ?? "");
  const [destination, setDestination] = useState<Destination>(() => (reuse ? destinationFromUrl(reuse.url, reuse.reading_list_id) : DEFAULT_DESTINATION));
  const [channels, setChannels] = useState<Record<Channel, boolean>>({ push: reuse ? reuse.channels.includes("push") : true, email: emailEnabled && (reuse ? reuse.channels.includes("email") : true) });
  const [everyone, setEveryone] = useState(reuse ? reuse.audience === "everyone" : true);
  const [later, setLater] = useState(false);
  const [date, setDate] = useState(() => addDay(lagosToday(), 1));
  const [time, setTime] = useState("07:00");
  const [confirming, setConfirming] = useState(false);
  const now = useNow();

  const list = destination.kind === "list" ? (lists.find((l) => l.id === destination.id) ?? null) : null;
  const url = destinationUrl(destination);
  const sendAt = later ? new Date(`${date}T${time}:00+01:00`) : null;
  const emails = channels.email ? (everyone ? audience.everyone : audience.optedIn) : 0;
  const days = emailDays(emails, sendAt ?? new Date(), audience);
  const lastDay = days.at(-1)?.day;
  const valid =
    !!title.trim() && !!body.trim() && (channels.push || channels.email) && isDestinationValid(destination) && (!later || (!!sendAt && sendAt.getTime() > now));
  const broadcast = {
    title,
    body,
    url,
    readingListId: list?.id ?? null,
    channels: (Object.keys(channels) as Channel[]).filter((c) => channels[c]),
    audience: everyone ? ("everyone" as const) : ("opted_in" as const),
    sendAt: sendAt?.toISOString() ?? null,
  };

  // Linking a list fills an empty title and message, and its day if that's
  // ahead; the editor can change all three.
  const chooseLink = (next: Destination) => {
    setDestination(next);
    const l = next.kind === "list" ? lists.find((x) => x.id === next.id) : null;
    if (!l) return;
    if (!title.trim()) setTitle(`${month(l.day)}’s reading list`);
    if (!body.trim()) setBody(`${l.title}: ${l.books} books to start with.`);
    if (l.day > lagosToday()) {
      setLater(true);
      setDate(l.day);
      setTime("07:00");
    }
  };

  return (
    <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className={card}>
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) setConfirming(true);
          }}
        >
          <TextField label="Title" id="broadcast-title" hint={`Email subject · ${title.length}/${TITLE_MAX}`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={TITLE_MAX} placeholder="New in the library" />
          <div>
            <TextAreaField
              label="Message"
              id="broadcast-body"
              hint={`${body.length}/${BODY_MAX}`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={BODY_MAX}
              rows={4}
              placeholder="Keep it short: most devices show two or three lines."
            />

          </div>

          <DestinationPicker value={destination} onChange={chooseLink} lists={lists} />

          <div>
            <div className={label}>Send via</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Option type="checkbox" checked={channels.push} onChange={(push) => setChannels((c) => ({ ...c, push }))} title="App notification" sub={`${n(audience.devices)} devices, and every member’s feed`} />
              <Option
                type="checkbox"
                checked={channels.email}
                disabled={!emailEnabled}
                onChange={(email) => setChannels((c) => ({ ...c, email }))}
                title="Email"
                sub={emailEnabled ? "To the inbox they signed up with" : "Not set up: RESEND_API_KEY is missing"}
              />
            </div>
          </div>

          {channels.email && (
            <div>
              <div className={label}>Email to</div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Option type="radio" checked={everyone} onChange={() => setEveryone(true)} title="Everyone" sub={`${n(audience.everyone)} members, minus anyone who unsubscribed`} />
                <Option type="radio" checked={!everyone} onChange={() => setEveryone(false)} title="Only those who opted in" sub={`${n(audience.optedIn)} members turned email on`} />
              </div>
            </div>
          )}

          <div>
            <div className={label}>When</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Option type="radio" checked={!later} onChange={() => setLater(false)} title="Now" />
              <Option type="radio" checked={later} onChange={() => setLater(true)} title="Later">
                {later && (
                  <span className="mt-2 flex flex-wrap items-center gap-2">
                    <input type="date" aria-label="Day" value={date} min={lagosToday()} onChange={(e) => setDate(e.target.value)} className="h-9 rounded-sm border border-sand-300 bg-[var(--reader-surface)] px-2.5 text-[13px] font-medium text-[var(--reader-text)]" />
                    <input type="time" aria-label="Time" value={time} onChange={(e) => setTime(e.target.value)} className="h-9 rounded-sm border border-sand-300 bg-[var(--reader-surface)] px-2.5 text-[13px] font-medium text-[var(--reader-text)]" />
                    <span className="text-[12px] font-medium text-[var(--reader-text-muted)]">Lagos</span>
                  </span>
                )}
              </Option>
            </div>
            {later && sendAt && sendAt.getTime() <= now && <p className="m-0 mt-1.5 text-[12px] font-semibold text-red-600">That time has passed.</p>}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--reader-border)] pt-4">
            <TestSend broadcast={broadcast} disabled={!emailEnabled || !title.trim() || !body.trim()} />
            <button type="submit" disabled={!valid} className={primary}>
              {later ? "Schedule…" : "Send…"}
            </button>
          </div>
        </form>
      </section>

      <aside className="flex flex-col gap-3">
        <Preview broadcast={broadcast} title={title} body={body} />
        <section className={card}>
          <h2 className={`${h2} mb-2`}>Who gets it</h2>
          {channels.push && <Count label="App notification" value={audience.devices} />}
          {channels.email && <Count label="Email" value={emails} />}
          {channels.email && emails > 0 && (
            <>
              <p className="m-0 mt-1 text-[12px] font-medium leading-relaxed text-[var(--reader-text-muted)]">
                Email goes out {n(audience.dailyLimit)} a day, in batches of 50.{" "}
                {days.length > 1 ? (
                  <>
                    Everyone has it by <b className="text-[var(--reader-text)]">{dayLabel(lastDay!)}</b>.
                  </>
                ) : (
                  "It all goes the same day."
                )}
              </p>
              {days.length > 1 && (
                <ul className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0">
                  {days.slice(0, 7).map((d) => (
                    <li key={d.day} className="grid grid-cols-[84px_minmax(0,1fr)_32px] items-center gap-2.5 text-[12px] font-semibold text-[var(--reader-text-muted)]">
                      {dayLabel(d.day)}
                      <span className="h-1.5 overflow-hidden rounded-full bg-[var(--reader-surface-hover)]">
                        <span className="block h-full bg-brand-500" style={{ width: `${(d.count / audience.dailyLimit) * 100}%` }} />
                      </span>
                      <span className="text-right tabular-nums">{d.count}</span>
                    </li>
                  ))}
                  {days.length > 7 && <li className="text-[12px] font-medium text-[var(--reader-text-muted)]">and {days.length - 7} more days</li>}
                </ul>
              )}
            </>
          )}
        </section>
      </aside>

      {confirming && (
        <Confirm
          broadcast={broadcast}
          rows={[
            ["What", list ? `${title} · with ${list.title}` : title],
            ...(channels.push ? [["App notification", `${n(audience.devices)} devices · ${sendAt ? when(sendAt) : "now"}`] as [string, string]] : []),
            ...(channels.email
              ? [["Email", `${n(emails)} ${everyone ? "members" : "opted-in members"}${days.length > 1 ? ` · ${n(audience.dailyLimit)} a day, done ${dayLabel(lastDay!)}` : ""}`] as [string, string]]
              : []),
          ]}
          later={later}
          onClose={() => setConfirming(false)}
          onSent={(id) => {
            router.push(`/admin/push/sent?sent=${id}`);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/** The time, refreshed each minute, for "that time has passed". */
function useNow() {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

const when = (d: Date) => shortDayTime(d);

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div role="radiogroup" className="inline-flex h-9 rounded-sm border border-sand-300 p-0.5">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`cursor-pointer rounded-[2px] border-none px-3.5 text-[13px] font-semibold transition-colors ${
            value === v ? "bg-[var(--reader-surface-hover)] text-[var(--reader-text)]" : "bg-transparent text-[var(--reader-text-muted)] hover:text-[var(--reader-text)]"
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** A choice as a bordered tile: a checkbox or a radio, with a line under it. */
function Option({ type, checked, onChange, title, sub, disabled, children }: { type: "checkbox" | "radio"; checked: boolean; onChange: (checked: boolean) => void; title: string; sub?: string; disabled?: boolean; children?: ReactNode }) {
  return (
    <label
      className={`flex gap-2.5 rounded-sm border px-3.5 py-3 ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${
        checked ? "border-brand-500 bg-brand-500/[0.04]" : "border-sand-300"
      }`}
    >
      <input type={type} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 flex-none accent-brand-500" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[13px] font-bold text-[var(--reader-text)]">{title}</span>
        {sub && <span className="mt-0.5 text-[12px] font-medium text-[var(--reader-text-muted)]">{sub}</span>}
        {children}
      </span>
    </label>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between border-b border-[var(--reader-border)] py-2 text-[13px] font-medium text-[var(--reader-text-muted)] last:border-none">
      {label}
      <span className="font-serif text-[18px] font-semibold tabular-nums text-[var(--reader-text)]">{n(value)}</span>
    </div>
  );
}

type BroadcastBody = Record<string, unknown>;

/** The email as members get it (rendered by the server), or the notification. */
function Preview({ broadcast, title, body }: { broadcast: BroadcastBody; title: string; body: string }) {
  const [tab, setTab] = useState<"email" | "notification">("email");
  const [html, setHtml] = useState<string | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setScale(Math.min(1, entry.contentRect.width / EMAIL_WIDTH)));
    observer.observe(el);
    return () => observer.disconnect();
  }, [tab]);
  const key = JSON.stringify({ title, body, url: broadcast.url, readingListId: broadcast.readingListId });

  // Redrawn a moment after typing stops.
  useEffect(() => {
    if (tab !== "email") return;
    const timer = setTimeout(async () => {
      const res = await fetch("/api/admin/push/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: key }).catch(() => null);
      if (res?.ok) setHtml(await res.text());
    }, 400);
    return () => clearTimeout(timer);
  }, [key, tab]);

  const openFull = () => {
    if (!html) return;
    window.open(URL.createObjectURL(new Blob([html], { type: "text/html" })), "_blank", "noopener");
  };

  return (
    <section className={card}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className={h2}>Preview</h2>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            ["email", "Email"],
            ["notification", "Notification"],
          ]}
        />
      </div>
      {tab === "email" ? (
        <>
          <div ref={frameRef} className="h-[360px] overflow-hidden rounded-sm border border-[var(--reader-border)] bg-[#f6f3ef]">
            {html ? (
              // Drawn at a desktop mail client's width, then scaled to the panel.
              <iframe
                title="Email preview"
                srcDoc={html}
                sandbox=""
                className="origin-top-left border-none"
                style={{ width: EMAIL_WIDTH, height: 360 / scale, transform: `scale(${scale})` }}
              />
            ) : (
              <p className="m-0 p-5 text-center text-[12px] font-medium text-[var(--reader-text-muted)]">Loading…</p>
            )}
          </div>
          {html && (
            <button type="button" onClick={openFull} className="mt-2 inline-flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-[12px] font-semibold text-[var(--reader-text-muted)] hover:text-[var(--reader-text)]">
              Open full email <ExternalLink size={12} />
            </button>
          )}
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <NotificationPreview title={title} body={body} />
          <FeedPreview title={title} body={body} />
        </div>
      )}
    </section>
  );
}

/** Approximates what sw.js's showNotification renders: exact chrome varies by OS and browser. */
function NotificationPreview({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex gap-3 rounded-lg border border-[var(--reader-border)] bg-[var(--reader-surface)] p-3 shadow-sm">
      <AppIcon size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2 text-[11px] font-medium text-[var(--reader-text-subtle)]">
          <span>Ominira</span>
          <span>now</span>
        </div>
        <p className="m-0 truncate text-[13px] font-semibold text-[var(--reader-text)]">{title.trim() || "Notification title"}</p>
        <p className="m-0 line-clamp-3 text-[12px] leading-snug text-[var(--reader-text-muted)]">{body.trim() || "Your message appears here."}</p>
      </div>
    </div>
  );
}

/** Mirrors a broadcast row in app/components/notifications/NotificationsView.tsx. */
function FeedPreview({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[var(--reader-border)] bg-[color-mix(in_srgb,var(--reader-accent)_7%,transparent)] p-3">
      <span aria-hidden style={{ background: "var(--color-olive-500)" }} className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-white">
        <Megaphone size={16} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[13px] leading-[1.45] text-[var(--reader-text)]">{title.trim() || "Title"}</span>
        <span className="line-clamp-2 font-serif text-[13px] italic leading-[1.6] text-[var(--reader-text-muted)]">{body.trim() || "Message"}</span>
        <span className="text-[11px] font-semibold tracking-wide text-[var(--reader-text-subtle)]">just now</span>
      </span>
    </div>
  );
}

/** "Send a test to me": one copy to an address this browser remembers. */
function TestSend({ broadcast, disabled }: { broadcast: BroadcastBody; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setMessage(null);
    try {
      localStorage.setItem(TEST_EMAIL_KEY, to.trim());
    } catch {}
    const res = await fetch("/api/admin/push/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: to.trim(), broadcast: { ...broadcast, sendAt: null } }) }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { error?: string } | null;
    setBusy(false);
    setMessage(res?.ok ? `Sent to ${to.trim()}.` : data?.error ?? "Couldn’t send. Try again.");
  };

  if (!open)
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          try {
            setTo(localStorage.getItem(TEST_EMAIL_KEY) ?? "");
          } catch {}
          setOpen(true);
        }}
        className={secondary}
      >
        Send a test to me
      </button>
    );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="email"
        aria-label="Send the test to"
        placeholder="you@example.com"
        value={to}
        autoFocus
        onChange={(e) => setTo(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (to.includes("@") && !busy) send();
          }
        }}
        className="h-9 w-56 rounded-sm border border-sand-300 bg-[var(--reader-surface)] px-3 text-[13px] font-medium text-[var(--reader-text)] outline-none focus:border-brand-400"
      />
      <button type="button" disabled={busy || !to.includes("@")} onClick={send} className={secondary}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : "Send test"}
      </button>
      {message && <span className="text-[12px] font-semibold text-[var(--reader-text-muted)]">{message}</span>}
    </div>
  );
}

/** One last look, then the send PIN. */
function Confirm({ broadcast, rows, later, onClose, onSent }: { broadcast: BroadcastBody; rows: [string, string][]; later: boolean; onClose: () => void; onSent: (id: string) => void }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    setPinError(null);
    try {
      const res = await fetch("/api/admin/push/broadcast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...broadcast, pin }) });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string; code?: string };
      if (res.ok && data.id) return onSent(data.id);
      if (data.code === "pin") {
        setPin("");
        setPinError(data.error ?? "That send PIN isn’t right.");
      } else setError(data.error ?? "Couldn’t send. Try again.");
    } catch {
      setError("Network error: it may have gone out. Check Sent before trying again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Close" onClick={busy ? undefined : onClose} className="absolute inset-0 cursor-default border-none bg-black/35" />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onSubmit={(e) => {
          e.preventDefault();
          if (pin.trim() && !busy) send();
        }}
        className="relative w-full max-w-[440px] rounded-sm bg-[var(--reader-surface)] p-6 shadow-xl"
      >
        <h2 id="confirm-title" className="m-0 font-serif text-[22px] font-semibold text-[var(--reader-text)]">
          {later ? "Schedule this broadcast?" : "Send this broadcast?"}
        </h2>
        <dl className="my-4 border-t border-[var(--reader-border)]">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-[var(--reader-border)] py-2.5 text-[13px]">
              <dt className="font-medium text-[var(--reader-text-muted)]">{k}</dt>
              <dd className="m-0 text-right font-semibold text-[var(--reader-text)]">{v}</dd>
            </div>
          ))}
        </dl>
        <TextField
          label="Send PIN"
          id="broadcast-pin"
          type="password"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
            setPinError(null);
          }}
          autoComplete="off"
          autoFocus
          error={pinError ?? undefined}
        />
        {error && (
          <p role="alert" className="m-0 mt-2 text-[12px] font-semibold text-red-600">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className={secondary}>
            Cancel
          </button>
          <button type="submit" disabled={!pin.trim() || busy} className={primary}>
            {busy && <Loader2 size={14} className="animate-spin" />}
            {later ? "Schedule" : busy ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
