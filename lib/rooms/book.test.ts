import { describe, expect, test } from "bun:test";
import type { CurrentReaderSummary } from "@/lib/api/types";
import { bookCta, bookHeader, chapterProgress, type BookFacts } from "./book";

const ENDS = [1, 2, 3, 4].map((n) => ({ id: `c${n}`, label: `Chapter ${n}`, endPct: n * 25 }));
const reader = (readerId: string, pct: number): CurrentReaderSummary => ({
  readerId,
  pseudonym: readerId,
  avatar: { color: null, url: null },
  mode: "read",
  updatedAt: "2026-10-13T10:00:00Z",
  pct,
  city: null,
  country: null,
});
const BOOK: BookFacts = {
  title: "The Wretched of the Earth",
  materialType: "book",
  author: "Frantz Fanon",
  cover: "/c.png",
  description: "",
  publishedYear: 1961,
  pageCountEstimate: 251,
  narratorCount: 1,
  noteCount: 128,
  readers: [reader("kemi", 60), reader("me", 30), reader("tunde", 10)],
  readerCount: 4,
};

describe("bookCta", () => {
  test("one resume action, in the mode last used", () => {
    expect(bookCta(null)).toBe("Start reading");
    expect(bookCta({ pct: 0, finished: false, listening: false })).toBe("Start reading");
    expect(bookCta({ pct: 18, finished: false, listening: false })).toBe("Continue reading");
    expect(bookCta({ pct: 18, finished: false, listening: true })).toBe("Continue listening");
    expect(bookCta({ pct: 100, finished: true, listening: false })).toBe("Read again");
    expect(bookCta({ pct: 100, finished: true, listening: true })).toBe("Listen again");
  });
});

describe("chapterProgress", () => {
  test("done, part way, not reached", () => {
    expect(chapterProgress(ENDS, { pct: 40, finished: false, listening: false })).toEqual([100, 60, null, null]);
    expect(chapterProgress(ENDS, null)).toEqual([null, null, null, null]);
  });
  test("a finished book is done throughout", () => {
    expect(chapterProgress(ENDS, { pct: 97, finished: true, listening: false })).toEqual([100, 100, 100, 100]);
  });
});

describe("bookHeader", () => {
  const h = bookHeader(BOOK, { pct: 18, finished: false, listening: false }, ENDS, "me");
  test("the viewer's place in words", () => {
    expect(h.pct).toBe(18);
    expect(h.progressLabel).toBe("Ch. 1 · 18%");
    expect(bookHeader(BOOK, null, ENDS, "me")).toMatchObject({ pct: null, progressLabel: "Not started", cta: "Start reading" });
    expect(bookHeader(BOOK, { pct: 99, finished: true, listening: false }, ENDS, "me")).toMatchObject({ pct: 100, progressLabel: "Finished" });
    expect(bookHeader(BOOK, { pct: 18, finished: false, listening: false }, [], "me").progressLabel).toBe("18%");
  });
  test("reading now never counts the viewer, and shows no one's place", () => {
    expect(h.readingNow).toBe(3);
    expect(h.readers.map((r) => r.comrade.readerId)).toEqual(["kemi", "tunde"]);
    expect(h.readers[0]).toEqual({ comrade: expect.any(Object) });
    expect(bookHeader(BOOK, null, ENDS, null).readingNow).toBe(4);
  });
  test("facts and contents", () => {
    expect(h.meta).toBe("EPUB · 1961 · 251 pages · Audiobook");
    expect(bookHeader({ ...BOOK, publishedYear: null, materialType: "webpage", narratorCount: 0 }, null, ENDS, null).meta).toBe("251 pages");
    expect(h.contents[0]).toEqual({ num: "1", label: "Chapter 1", pct: 72, id: "c1" });
  });
});
