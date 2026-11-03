"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { AFRICAN_VOICES } from "@/lib/audio/voices";
import type { LandingBook } from "@/lib/landing/view";
import Cover from "./Cover";

// The listening player: every voice reads the same line (generated once on
// the Pocket TTS host; a new line goes in a new v<n>/ folder). Each word
// lights up as it's read; nothing plays until tapped, and one at a time.

const SAMPLE = (id: string) => `${process.env.NEXT_PUBLIC_CDN_BASE}/site/voice-samples/v1/${id}.mp3`;
const WORDS = "Each generation must, out of relative obscurity, discover its mission, fulfil it, or betray it.".split(" ");
const WHERE = "On National Culture";
/** Each sample's length (ms), so the time shows before it loads. */
const SAMPLE_MS: Record<string, number> = {
  abiodun: 7040, female9: 7920, male1: 6320, female1: 5440, male2: 6320, female6: 6960,
  male4: 7760, female4: 6640, male6: 6080, female2w: 6480, male3: 6480, female5: 7840,
};
/** Where each word starts, as a share of the read (by its length, and a
 * comma's pause counted as two letters). */
const WEIGHT = WORDS.map((w) => w.length + 1 + (/[,.]$/.test(w) ? 2 : 0));
const TOTAL = WEIGHT.reduce((a, b) => a + b, 0);
const STARTS = WEIGHT.map((_, i) => WEIGHT.slice(0, i).reduce((a, b) => a + b, 0) / TOTAL);

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export default function Voices({ book }: { book: LandingBook | null }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const frame = useRef(0);
  const [sel, setSel] = useState(AFRICAN_VOICES[0].id);
  const [playing, setPlaying] = useState(false);
  const [ms, setMs] = useState(0);
  useEffect(
    () => () => {
      audio.current?.pause();
      cancelAnimationFrame(frame.current);
    },
    []
  );

  const stop = () => {
    audio.current?.pause();
    cancelAnimationFrame(frame.current);
    setPlaying(false);
  };
  const load = (id: string) => {
    const a = new Audio(SAMPLE(id));
    a.onended = () => {
      cancelAnimationFrame(frame.current);
      setPlaying(false);
      setMs(0);
      a.currentTime = 0;
    };
    return a;
  };
  const play = (id: string) => {
    stop();
    const resume = id === sel && audio.current;
    const a = resume ? audio.current! : load(id);
    if (!resume) setMs(0);
    const tick = () => {
      setMs(a.currentTime * 1000);
      frame.current = requestAnimationFrame(tick);
    };
    a.play().then(tick, () => setPlaying(false));
    audio.current = a;
    setSel(id);
    setPlaying(true);
  };
  const toggle = (id: string) => (playing && sel === id ? stop() : play(id));

  const voice = AFRICAN_VOICES.find((v) => v.id === sel)!;
  const dur = SAMPLE_MS[sel] ?? 7000;
  const share = Math.min(0.999, ms / dur);
  const current = ms > 0 ? STARTS.findLastIndex((s) => s <= share) : -1;

  const caption = book && (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="font-serif text-[17px]/[1.3] font-semibold">{book.title}</span>
      <span className="text-ui-caption text-sand-25/68">
        {book.author} · {WHERE}
      </span>
    </div>
  );

  // One column beside the cover: the passage, then the player, then the
  // voices, so all of it sits within reach of the words being read.
  return (
    <div className="flex items-start gap-10 rounded-sm bg-sand-950 p-5 text-sand-25 md:p-10 lg:gap-14">
      {book && (
        <div className="hidden w-[clamp(150px,13vw,190px)] flex-none flex-col gap-4 md:flex">
          <div className="-rotate-[1.5deg]">
            <Cover book={book} shadow="shadow-[0_24px_48px_rgba(0,0,0,0.55)]" className="w-full" />
          </div>
          {caption}
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-6 md:gap-8">
        {book && (
          <div className="flex items-center gap-4 md:hidden">
            <Cover book={book} shadow="shadow-[0_12px_24px_rgba(0,0,0,0.5)]" className="w-16 flex-none" />
            {caption}
          </div>
        )}
        <p className="m-0 font-serif text-[clamp(24px,2.6vw,36px)]/[1.45] text-pretty" aria-live="off">
          {WORDS.map((w, i) => (
            <span key={i}>
              <span
                className={`-mx-[3px] rounded-xs px-[3px] transition-[background-color,color] duration-150 ease-out ${
                  i === current ? "bg-quote-wash text-sand-950" : current < 0 || i < current ? "text-sand-25" : "text-sand-25/50"
                }`}
              >
                {w}
              </span>{" "}
            </span>
          ))}
        </p>

        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={() => toggle(sel)}
            aria-label={`${playing ? "Stop" : "Play"} ${voice.name}'s sample`}
            className="flex size-12 flex-none cursor-pointer items-center justify-center rounded-full border-0 bg-brand-500 text-sand-25 transition-colors hover:bg-brand-600"
          >
            {playing ? <Pause size={20} fill="currentColor" strokeWidth={0} /> : <Play size={20} fill="currentColor" strokeWidth={0} className="ml-0.5" />}
          </button>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex justify-between gap-3 text-ui-sm">
              <span className="truncate">
                {voice.name}
                <span className="text-sand-25/68"> · {voice.country}</span>
              </span>
              <span className="whitespace-nowrap text-sand-25/68 tabular-nums">
                {clock(ms)} / {clock(dur)}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-sand-25/16">
              <div className="h-full rounded-[inherit] bg-brand-300" style={{ width: `${(share * 100).toFixed(1)}%` }} />
            </div>
          </div>
        </div>

        <ul className="-mx-5 m-0 flex list-none gap-3 overflow-x-auto border-t border-white/16 px-5 pt-6 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-6 md:gap-x-2 md:gap-y-5 md:overflow-visible md:px-0 md:pt-8 xl:grid-cols-12">
          {AFRICAN_VOICES.map((v) => {
            const chosen = sel === v.id;
            const on = chosen && playing;
            return (
              <li key={v.id} className="flex flex-none justify-center">
                <button
                  type="button"
                  onClick={() => toggle(v.id)}
                  aria-pressed={on}
                  aria-label={`${on ? "Stop" : "Play"} ${v.name}'s sample, ${v.country}`}
                  className="flex w-20 cursor-pointer flex-col items-center gap-2 border-0 bg-transparent p-0 text-sand-25"
                >
                  <span
                    className={`relative block size-18 rounded-full transition-shadow duration-200 ${
                      chosen ? "shadow-[0_0_0_2px_var(--color-sand-950),0_0_0_4px_var(--color-brand-300)]" : ""
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={v.avatar} alt="" loading="lazy" className="size-full rounded-full object-cover" />
                    {on && (
                      <span className="absolute inset-0 flex items-center justify-center gap-0.5 rounded-full bg-sand-950/62">
                        {[0, 1, 2, 3].map((k) => (
                          <span key={k} className="landing-eq h-5 w-[3px] origin-center rounded-[2px] bg-sand-25" style={{ animationDelay: `${k * -0.23}s` }} />
                        ))}
                      </span>
                    )}
                  </span>
                  <span className={`text-ui-sm whitespace-nowrap ${chosen ? "text-sand-25" : "text-sand-25/68"}`}>{v.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
