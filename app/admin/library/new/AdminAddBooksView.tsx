"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { AlertCircle, CloudUpload, Link2, X } from "lucide-react";
import AdminPageHeader from "@/app/admin/AdminPageHeader";
import { apiFetch } from "@/lib/api/client";
import { cleanTitle } from "@/lib/materials/cleanTitle";
import {
  DriveError,
  connectDrive,
  downloadDriveFile,
  driveFolderId,
  driveFolderName,
  driveSignedIn,
  listDriveFolder,
  preloadDriveSignIn,
  refreshDrive,
  watchDriveSignIn,
  type DriveFile,
} from "@/lib/materials/googleDrive";
import { ACCEPTED_FILE_TYPES, ADMIN_UPLOAD_LIMITS } from "@/lib/materials/uploadLimits";
import { useUploadBook } from "@/lib/materials/useUploadBook";

/** One book at a time: download, read, upload, publish, then the next.
 * Parallel books only got Drive and R2 to throttle and fail them. */
const CONCURRENCY = 1;
const MAX_BYTES = ADMIN_UPLOAD_LIMITS.maxFileSizeBytes;
const MAX_MB = Math.round(MAX_BYTES / 1048576);

type Status = "queued" | "downloading" | "reading" | "uploading" | "added" | "skipped" | "failed" | "cancelled";
const ACTIVE: Status[] = ["downloading", "reading", "uploading"];
const LABEL: Record<Status, string> = {
  queued: "Queued",
  downloading: "Downloading",
  reading: "Reading",
  uploading: "Uploading",
  added: "Added",
  skipped: "Skipped",
  failed: "Failed",
  cancelled: "Not imported",
};
const DOT: Record<Status, string> = {
  queued: "bg-[var(--reader-border)]",
  downloading: "bg-brand-300",
  reading: "bg-brand-300",
  uploading: "bg-brand-300",
  added: "bg-brand-500",
  skipped: "bg-[var(--reader-text-subtle)]",
  failed: "bg-brand-800",
  cancelled: "bg-[var(--reader-border)]",
};

type Item = {
  id: number;
  /** "Dropped · " or "Folder / sub / " shown before the file name. */
  where: string;
  name: string;
  ext: string;
  drive?: DriveFile;
  file?: File;
  status: Status;
  /** 0–1 while downloading or uploading. */
  progress: number;
  title: string;
  author: string;
  /** Title/author changed by hand: kept over the parsed guess and saved once the book exists. */
  edited: boolean;
  cover?: string;
  note?: string;
  /** Skipped only as a copy of a book already here: "Add anyway" can queue it. */
  duplicate?: boolean;
  materialId?: string;
  slug?: string;
};

type LinkError = "blank" | "invalid" | "private" | "signin" | "empty" | "other";
const LINK_ERRORS: Record<LinkError, [string, string]> = {
  blank: ["Paste a folder link first.", "Copy it from the folder’s Share menu in Google Drive."],
  invalid: ["That isn’t a Google Drive folder link.", "Folder links start with drive.google.com/drive/folders/ — copy one from the folder’s Share menu."],
  private: ["Your Google account can’t open this folder.", "In Drive, open Share → General access and choose “Anyone with the link”, then import again."],
  signin: ["Sign in with Google to import.", "Drive folders are read with your Google account, read-only. Press Import and finish the sign-in."],
  empty: ["This folder has no files.", "Check it’s the right folder. Subfolders are included."],
  other: ["Couldn’t reach Google Drive.", "Check your connection and try again."],
};

type Filter = "all" | "added" | "skipped" | "failed";

const normalise = (title: string) => title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const extOf = (name: string) => (name.includes(".") ? name.split(".").pop()!.toLowerCase() : "");

/**
 * /admin/library/new: drop files or paste a public Google Drive folder link;
 * both feed one list that works through the files one at a time — download
 * (Drive only), read, upload, publish as public — through the same
 * useUploadBook pipeline as every other upload. All of it runs in this tab.
 */
export default function AdminAddBooksView({
  libraryTitles,
  librarySizes,
  initialLink = "",
}: {
  libraryTitles: string[];
  librarySizes: number[];
  initialLink?: string;
}) {
  const router = useRouter();
  const { upload } = useUploadBook();

  const [items, setItems] = useState<Item[]>([]);
  const [link, setLink] = useState(initialLink);
  const [linkError, setLinkError] = useState<LinkError | null>(null);
  const [listing, setListing] = useState(false);
  const [paused, setPaused] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [dragging, setDragging] = useState(false);
  const [needsGoogle, setNeedsGoogle] = useState(false);

  const nextId = useRef(0);
  const started = useRef(new Set<number>());
  const aborts = useRef(new Map<number, AbortController>());
  const cancelledIds = useRef(new Set<number>());
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const known = useRef(new Set(libraryTitles.map(normalise)));
  // Byte sizes of files already here: two different books are never the same
  // size to the byte, so this is the reliable check (titles vary by source).
  const knownSizes = useRef(new Set(librarySizes));
  const inputRef = useRef<HTMLInputElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);

  const patch = (id: number, p: Partial<Item>) => setItems((list) => list.map((it) => (it.id === id ? { ...it, ...p } : it)));

  const total = items.length;
  const count = (s: Status) => items.filter((it) => it.status === s).length;
  const added = count("added"),
    skipped = count("skipped"),
    failed = count("failed"),
    notImported = count("cancelled");
  const active = items.filter((it) => ACTIVE.includes(it.status));
  const running = items.some((it) => it.status === "queued" || ACTIVE.includes(it.status));
  const finished = total > 0 && !running && !listing;

  // Google's sign-in script loads up front so Import can open its popup at
  // once, and a sign-in kept from before is picked up so no popup is needed.
  useEffect(() => {
    preloadDriveSignIn().catch(() => {});
    void refreshDrive();
    return watchDriveSignIn(setNeedsGoogle);
  }, []);

  // While importing: warn before leaving, hold a Web Lock so the browser
  // doesn't freeze or discard the tab in the background, and keep the
  // screen (so the computer) awake while the tab is showing.
  useEffect(() => {
    if (!running) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    let stopped = false;
    let release = () => {};
    navigator.locks?.request("book-import", () => (stopped ? undefined : new Promise<void>((done) => (release = done)))).catch(() => {});
    let wake: WakeLockSentinel | null = null;
    const awake = () => {
      if (document.visibilityState !== "visible" || stopped) return;
      navigator.wakeLock
        ?.request("screen")
        .then((w) => {
          if (stopped) void w.release();
          else wake = w;
        })
        .catch(() => {});
    };
    awake();
    document.addEventListener("visibilitychange", awake);
    return () => {
      stopped = true;
      release();
      wake?.release().catch(() => {});
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("visibilitychange", awake);
    };
  }, [running]);

  // Start queued files while there's a free slot.
  useEffect(() => {
    if (paused) return;
    let slots = CONCURRENCY - items.filter((it) => ACTIVE.includes(it.status)).length;
    for (const it of items) {
      if (slots <= 0) break;
      if (it.status !== "queued" || started.current.has(it.id)) continue;
      started.current.add(it.id);
      slots--;
      void process(it);
    }
    // process reads the latest state through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, paused]);

  async function process(it: Item) {
    const abort = new AbortController();
    aborts.current.set(it.id, abort);
    // Progress in whole percents: every Drive/XHR chunk re-rendering
    // hundreds of rows is what makes a big import stutter.
    let shown = -1;
    const onProgress = (fraction: number) => {
      const pct = Math.floor(fraction * 100);
      if (pct !== shown) patch(it.id, { progress: (shown = pct) / 100 });
    };
    try {
      // A Drive download lives only in this call, never in state: kept on
      // the row, 900 books' bytes stayed in memory and crashed the tab.
      let file = it.file;
      if (!file) {
        patch(it.id, { status: "downloading", progress: 0 });
        file = await downloadDriveFile(it.drive!, onProgress, abort.signal, (until) =>
          patch(it.id, { note: until ? `Google Drive limit reached · trying again at ${until.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}` : undefined })
        );
      }
      const result = await upload(file, {
        visibility: "public",
        asAdmin: true,
        onStage: (stage) => {
          shown = 0;
          if (stage === "parsing") patch(it.id, { status: "reading", progress: 0 });
          if (stage === "uploading") patch(it.id, { status: "uploading", progress: 0 });
        },
        onProgress,
        onThumbnail: (cover) => patch(it.id, { cover }),
        onMetadata: (guess) => setItems((list) => list.map((x) => (x.id === it.id && !x.edited ? { ...x, ...guess } : x))),
      });
      known.current.add(normalise(result.title));
      knownSizes.current.add(file.size);
      if (cancelledIds.current.has(it.id)) {
        apiFetch(`/admin/materials/${result.materialId}`, { method: "DELETE" }).catch(() => {});
        return;
      }
      const latest = itemsRef.current.find((x) => x.id === it.id);
      if (latest?.edited) save(result.materialId, latest);
      patch(it.id, { status: "added", progress: 1, materialId: result.materialId, slug: result.slug, note: undefined });
    } catch (err) {
      if (cancelledIds.current.has(it.id)) return;
      patch(it.id, { status: "failed", note: err instanceof Error ? err.message : "Could not add this file." });
    } finally {
      aborts.current.delete(it.id);
    }
  }

  function save(materialId: string, it: Pick<Item, "title" | "author">) {
    apiFetch(`/admin/materials/${materialId}`, { method: "PATCH", json: { title: it.title.trim(), author: it.author.trim() } }).catch(() => {});
  }

  /** New rows, with files that can't or needn't be uploaded skipped up front.
   * Within one batch an EPUB beats a PDF/DOCX of the same title. */
  function toItems(entries: { name: string; size: number; where: string; drive?: DriveFile; file?: File }[]): Item[] {
    const rank = (ext: string) => ["epub", "pdf", "docx"].indexOf(ext);
    const keep = new Map<string, number>();
    const sizes = new Set<number>();
    const rows: Item[] = [];
    for (const e of entries) {
      const ext = extOf(e.name);
      const { title, author } = cleanTitle(e.name);
      // Google Docs list with no size (exported on download), so 0 never matches.
      const sized = e.size > 0;
      let note: string | undefined;
      if (rank(ext) < 0) note = `Not a book file (.${ext || "unknown"})`;
      else if (e.size > MAX_BYTES) note = `Over ${MAX_MB} MB (${Math.round(e.size / 1048576)} MB)`;
      else if ((sized && knownSizes.current.has(e.size)) || known.current.has(normalise(title))) note = "Already in library";
      else if (sized && sizes.has(e.size)) note = "Same file as another one here";
      if (!note && sized) sizes.add(e.size);
      const item: Item = {
        id: ++nextId.current,
        where: e.where,
        name: e.name,
        ext,
        drive: e.drive,
        file: e.file,
        status: note ? "skipped" : "queued",
        progress: 0,
        title: note && rank(ext) < 0 ? e.name : title,
        author: author ?? "",
        edited: false,
        note,
        duplicate: note === "Already in library" || note === "Same file as another one here",
      };
      if (!note) {
        const key = normalise(title);
        const other = keep.get(key);
        if (other === undefined) keep.set(key, rows.length);
        else if (rank(ext) < rank(rows[other].ext)) {
          Object.assign(rows[other], { status: "skipped", note: "Same book as another file here", duplicate: true });
          keep.set(key, rows.length);
        } else Object.assign(item, { status: "skipped", note: "Same book as another file here", duplicate: true });
      }
      rows.push(item);
    }
    entries.forEach((e, i) => {
      if (rows[i].status !== "queued") return;
      known.current.add(normalise(rows[i].title));
      if (e.size > 0) knownSizes.current.add(e.size);
    });
    return rows;
  }
  async function importFolder() {
    const url = link.trim();
    if (!url) return setLinkError("blank");
    const folderId = driveFolderId(url);
    if (!folderId) return setLinkError("invalid");
    setLinkError(null);
    setListing(true);
    setCancelled(false);
    setFilter("all");
    try {
      if (!driveSignedIn()) await connectDrive();
      const [name, files] = await Promise.all([driveFolderName(folderId), listDriveFolder(folderId)]);
      if (!files.length) return setLinkError("empty");
      setLink("");
      const fresh = toItems(
        files.map((f) => ({ name: f.name, size: f.size, drive: f, where: `${name} / ${f.folder.replace(/\/$/, "").split("/").filter(Boolean).join(" / ")}${f.folder ? " / " : ""}` }))
      );
      setItems((list) => [...list, ...fresh]);
      setPaused(false);
    } catch (err) {
      setLinkError(err instanceof DriveError && err.kind !== "other" ? err.kind : "other");
    } finally {
      setListing(false);
    }
  }

  function addFiles(picked: FileList | File[] | null) {
    if (!picked?.length) return;
    const fresh = toItems(Array.from(picked).map((file) => ({ name: file.name, size: file.size, file, where: "Dropped · " })));
    if (inputRef.current) inputRef.current.value = "";
    setItems((list) => [...fresh, ...list]);
    setCancelled(false);
    setPaused(false);
  }

  function retry(it: Item) {
    started.current.delete(it.id);
    cancelledIds.current.delete(it.id);
    patch(it.id, { status: "queued", note: undefined, duplicate: false, progress: 0 });
    setCancelled(false);
  }

  /** × on a row: drops it from the list, stopping it if it's running and
   * deleting the book (row and files) if it was already added. Its title and
   * size stop counting as "in the library", so it can be added again. */
  async function remove(it: Item) {
    if (it.status === "added") {
      if (!it.materialId || !window.confirm(`Delete “${it.title}” from the library?`)) return;
      patch(it.id, { note: "Deleting…" });
      try {
        await apiFetch(`/admin/materials/${it.materialId}`, { method: "DELETE" });
      } catch {
        return patch(it.id, { note: "Could not delete this book. Try again." });
      }
    } else if (it.status === "queued" || ACTIVE.includes(it.status)) {
      // A file mid-upload finishes, then process() deletes the new book.
      cancelledIds.current.add(it.id);
      aborts.current.get(it.id)?.abort();
    }
    if (it.status === "queued" || it.status === "added" || ACTIVE.includes(it.status)) {
      known.current.delete(normalise(it.title));
      knownSizes.current.delete(it.drive?.size ?? it.file?.size ?? 0);
    }
    if (it.cover) URL.revokeObjectURL(it.cover);
    setItems((list) => list.filter((x) => x.id !== it.id));
  }

  function cancel() {
    for (const it of itemsRef.current) {
      if (it.status !== "queued" && !ACTIVE.includes(it.status)) continue;
      cancelledIds.current.add(it.id);
      aborts.current.get(it.id)?.abort();
    }
    setItems((list) => list.map((it) => (it.status === "queued" || ACTIVE.includes(it.status) ? { ...it, status: "cancelled", progress: 0 } : it)));
    setCancelled(true);
    setPaused(false);
  }

  function reset() {
    for (const it of items) if (it.cover) URL.revokeObjectURL(it.cover);
    setItems([]);
    setFilter("all");
    setCancelled(false);
    started.current.clear();
    cancelledIds.current.clear();
    requestAnimationFrame(() => linkRef.current?.focus());
  }

  function edit(it: Item, field: "title" | "author", value: string) {
    patch(it.id, { [field]: value, edited: true });
  }

  const dragHandlers = {
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: (e: DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      addFiles(e.dataTransfer.files);
    },
  };

  const hasList = total > 0 || listing;
  const shown = items.filter((it) => filter === "all" || it.status === filter);
  const pct = (n: number) => `${total ? (n / total) * 100 : 0}%`;
  const summary = `${added} of ${total} added${skipped ? ` · ${skipped} skipped` : ""}${failed ? ` · ${failed} failed` : ""}`;
  const driveWait = active.find((it) => it.status === "downloading" && it.note)?.note;
  const footNote = needsGoogle
    ? "Google sign-in expired — sign in again to carry on."
    : paused
    ? "Paused — nothing new will start until you resume."
    : driveWait
      ? `${driveWait} · it carries on by itself. Keep this tab open.`
      : running
      ? `${active.length ? `Working on ${active.map((it) => it.title).join(" and ")}` : "Starting"} · Keep this tab open until it finishes.`
      : cancelled
        ? `Cancelled — ${notImported} not imported`
        : "Finished. Every added book is public now.";
  const err = linkError ? LINK_ERRORS[linkError] : null;

  const linkField = (compact: boolean) => (
    <div className={`flex min-w-0 flex-1 items-center gap-2 rounded-sm border bg-[var(--reader-surface)] px-3 ${compact ? "h-9" : "h-10"} ${
      err && linkError !== "empty" ? "border-brand-500" : "border-[var(--reader-border)]"
    }`}>
      <Link2 size={compact ? 15 : 16} className="flex-none text-[var(--reader-text-subtle)]" />
      <input
        ref={linkRef}
        value={link}
        onChange={(e) => {
          setLink(e.target.value);
          setLinkError(null);
        }}
        onKeyDown={(e) => e.key === "Enter" && importFolder()}
        placeholder={compact ? "Paste another Drive folder link" : "Paste a Google Drive folder link"}
        aria-label="Google Drive folder link"
        className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-[var(--reader-text)] outline-none placeholder:text-[var(--reader-text-subtle)]"
      />
    </div>
  );
  const browse = (label: string) => (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className="cursor-pointer border-none bg-transparent p-0 font-[inherit] text-brand-500 underline underline-offset-[3px]"
    >
      {label}
    </button>
  );

  return (
    <div className="relative mx-auto flex min-h-full w-full max-w-[1040px] flex-col" {...dragHandlers}>
      <AdminPageHeader
        title="Add books"
        subtitle="Grow the library — uploads are published as soon as they finish."
        back={{ href: "/admin/library", label: "Library" }}
      />
      <input ref={inputRef} type="file" multiple accept={ACCEPTED_FILE_TYPES} className="hidden" onChange={(e) => addFiles(e.target.files)} />

      <div className="flex flex-col gap-6 pb-8">
        {!hasList ? (
          <div className="flex flex-col items-center gap-4 rounded-sm border-[1.5px] border-dashed border-[var(--reader-border)] bg-[var(--reader-surface-hover)]/40 px-4 py-7 text-center sm:px-8 sm:py-12">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-500/10 text-brand-500">
              <CloudUpload size={22} />
            </span>
            <p className="m-0 text-[15px] font-bold text-[var(--reader-text)]">Drag books here or {browse("browse your files")}</p>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {["EPUB", "PDF", "DOCX"].map((f) => (
                <span key={f} className="rounded-sm border border-[var(--reader-border)] bg-[var(--reader-surface)] px-2 py-1 text-[11px] font-bold tracking-wide text-[var(--reader-text-muted)]">
                  {f}
                </span>
              ))}
              <span className="ml-1 text-[12px] text-[var(--reader-text-subtle)]">Up to {MAX_MB} MB each</span>
            </div>
            <div className="mt-2 flex w-full max-w-[560px] items-center gap-3">
              <span className="h-px flex-1 bg-[var(--reader-border)]" />
              <span className="text-[12px] text-[var(--reader-text-subtle)]">or import a Google Drive folder</span>
              <span className="h-px flex-1 bg-[var(--reader-border)]" />
            </div>
            <div className="flex w-full max-w-[560px] flex-wrap gap-2">
              {linkField(false)}
              <button type="button" onClick={importFolder} className="h-10 cursor-pointer rounded-sm border-none bg-brand-500 px-5 text-[13px] font-bold text-white hover:bg-brand-600">
                Import
              </button>
            </div>
            {err && (
              <div
                role="alert"
                className={`flex w-full max-w-[560px] items-start gap-2.5 rounded-sm border px-3.5 py-3 text-left ${
                  linkError === "empty" ? "border-[var(--reader-border)] bg-[var(--reader-surface-hover)]" : "border-brand-200 bg-brand-50"
                }`}
              >
                <AlertCircle size={18} className={`mt-px flex-none ${linkError === "empty" ? "text-[var(--reader-text-subtle)]" : "text-brand-500"}`} />
                <span className="flex flex-col gap-0.5">
                  <span className="text-[14px] font-semibold text-[var(--reader-text)]">{err[0]}</span>
                  <span className="text-[13px] text-[var(--reader-text-muted)]">{err[1]}</span>
                </span>
              </div>
            )}
            <p className="m-0 max-w-[520px] text-[12px] text-[var(--reader-text-subtle)]">
              Every file in the folder and its subfolders is imported. You sign in with Google (read-only) once; it stays signed in.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-sm border-[1.5px] border-dashed border-[var(--reader-border)] bg-[var(--reader-surface-hover)]/40 px-3.5 py-3">
              <div className="flex flex-[1_1_220px] items-center gap-2.5">
                <CloudUpload size={18} className="flex-none text-brand-500" />
                <span className="text-[13px] font-semibold text-[var(--reader-text)]">Drop more books or {browse("browse")}</span>
                <span className="text-[12px] text-[var(--reader-text-subtle)]">EPUB, PDF, DOCX · {MAX_MB} MB</span>
              </div>
              <div className="flex min-w-0 flex-[1_1_340px] gap-2">
                {linkField(true)}
                <button
                  type="button"
                  onClick={importFolder}
                  disabled={listing}
                  className="h-9 cursor-pointer rounded-sm border border-[var(--reader-border)] bg-[var(--reader-surface)] px-4 text-[13px] font-bold text-[var(--reader-text)] hover:bg-[var(--reader-surface-hover)] disabled:opacity-50"
                >
                  Import
                </button>
              </div>
            </div>
            {err && (
              <p role="alert" className="m-0 flex items-start gap-2 text-[13px] text-[var(--reader-text-muted)]">
                <AlertCircle size={16} className="mt-px flex-none text-brand-500" />
                <span>
                  <b className="font-semibold text-[var(--reader-text)]">{err[0]}</b> {err[1]}
                </span>
              </p>
            )}
          </div>
        )}

        {finished && (
          <div className="flex flex-col gap-5 rounded-sm border border-[var(--reader-border)] p-5 sm:px-8 sm:py-7">
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold tracking-[0.08em] text-brand-500 uppercase">Import finished</span>
              <span className="font-serif type-3 text-[var(--reader-text)]">
                {added} {added === 1 ? "book" : "books"} added to the library
              </span>
              <span className="text-[14px] text-[var(--reader-text-muted)]">
                {[skipped && `${skipped} skipped`, failed && `${failed} failed`, notImported && `${notImported} not imported`].filter(Boolean).join(" · ") ||
                  "Nothing skipped or failed."}
              </span>
            </div>
            {added > 0 && (
              <div className="flex gap-1.5 overflow-hidden">
                {items
                  .filter((it) => it.status === "added")
                  .slice(0, 16)
                  .map((it) => (
                    <Cover key={it.id} item={it} className="h-[66px] w-11" />
                  ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/library" className="flex h-9 items-center rounded-sm bg-brand-500 px-4 text-[13px] font-bold text-white no-underline hover:bg-brand-600">
                View in library
              </Link>
              <button type="button" onClick={reset} className="h-9 cursor-pointer rounded-sm border border-[var(--reader-border)] bg-transparent px-4 text-[13px] font-bold text-[var(--reader-text)] hover:bg-[var(--reader-surface-hover)]">
                Import another folder
              </button>
              {failed > 0 && (
                <button type="button" onClick={() => setFilter("failed")} className="h-9 cursor-pointer rounded-sm border-none bg-transparent px-3 text-[13px] font-bold text-brand-500 hover:bg-[var(--reader-surface-hover)]">
                  Review {failed} failed
                </button>
              )}
            </div>
          </div>
        )}

        {listing && (
          <p className="m-0 flex items-center gap-2.5 border-b border-[var(--reader-border)] py-3.5 text-[13px] font-semibold text-[var(--reader-text-muted)]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand-400" />
            Listing files in the folder and its subfolders…
          </p>
        )}

        {total > 0 && (
          <div>
            <div className="flex gap-4 overflow-x-auto border-b border-[var(--reader-border)] sm:gap-6">
              {(
                [
                  ["all", "All", total],
                  ["added", "Added", added],
                  ["skipped", "Skipped", skipped],
                  ["failed", "Failed", failed],
                ] as const
              ).map(([value, label, n]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  aria-current={filter === value ? "page" : undefined}
                  className={`-mb-px flex h-11 cursor-pointer items-center gap-1.5 border-x-0 border-t-0 border-b-2 bg-transparent px-0.5 text-[13px] font-bold whitespace-nowrap ${
                    filter === value ? "border-brand-500 text-[var(--reader-text)]" : "border-transparent text-[var(--reader-text-muted)] hover:text-[var(--reader-text)]"
                  }`}
                >
                  {label}
                  <span className="text-[12px] font-medium text-[var(--reader-text-subtle)]">{n}</span>
                </button>
              ))}
            </div>

            <ul className="m-0 list-none p-0">
              {shown.map((it) => (
                <Row key={it.id} item={it} onEdit={edit} onSave={(x) => x.materialId && save(x.materialId, x)} onRetry={retry} onRemove={remove} />
              ))}
            </ul>
            {!shown.length && <p className="m-0 py-8 text-center text-[14px] text-[var(--reader-text-subtle)]">Nothing here.</p>}
          </div>
        )}
      </div>

      {total > 0 && (
        <div className="sticky bottom-0 z-10 mt-auto -mx-4 border-t border-[var(--reader-border)] bg-[var(--reader-bg)] sm:mx-0">
          <div className="absolute inset-x-0 -top-px flex h-[3px] bg-[var(--reader-surface-hover)]">
            <div className="bg-brand-500 transition-[width] duration-300" style={{ width: pct(added) }} />
            <div className="bg-brand-200 transition-[width] duration-300" style={{ width: pct(active.length) }} />
            <div className="bg-brand-800 transition-[width] duration-300" style={{ width: pct(failed) }} />
            <div className="bg-[var(--reader-border)] transition-[width] duration-300" style={{ width: pct(skipped) }} />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 px-4 py-3 sm:px-0 sm:py-3.5">
            <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-0.5">
              <span className="text-[15px] font-bold text-[var(--reader-text)]">{summary}</span>
              <span className="truncate text-[12px] text-[var(--reader-text-muted)]">{footNote}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {running && needsGoogle && (
                <button type="button" onClick={() => connectDrive().catch(() => {})} className="h-9 cursor-pointer rounded-sm border-none bg-brand-500 px-4 text-[13px] font-bold text-white hover:bg-brand-600">
                  Continue with Google
                </button>
              )}
              {running && (
                <>
                  <button type="button" onClick={() => setPaused(!paused)} className="h-9 cursor-pointer rounded-sm border border-[var(--reader-border)] bg-transparent px-4 text-[13px] font-bold text-[var(--reader-text)] hover:bg-[var(--reader-surface-hover)]">
                    {paused ? "Resume" : "Pause"}
                  </button>
                  <button type="button" onClick={cancel} className="h-9 cursor-pointer rounded-sm border-none bg-transparent px-3 text-[13px] font-bold text-[var(--reader-text-muted)] hover:bg-[var(--reader-surface-hover)]">
                    Cancel
                  </button>
                </>
              )}
              <button
                type="button"
                disabled={!finished}
                onClick={() => router.push("/admin/library")}
                className="h-9 cursor-pointer rounded-sm border-none bg-brand-500 px-5 text-[13px] font-bold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-sm border-2 border-dashed border-brand-500 bg-brand-50/90 text-[15px] font-bold text-brand-600">
          Drop to add these files to the list
        </div>
      )}
    </div>
  );
}

function Cover({ item, className }: { item: Item; className: string }) {
  return (
    <span className={`relative flex flex-none items-center justify-center overflow-hidden rounded-sm border border-[var(--reader-border)] bg-[var(--reader-surface-hover)] ${className}`}>
      {item.cover ? (
        // eslint-disable-next-line @next/next/no-img-element -- a local blob: URL
        <img src={item.cover} alt="" className="h-full w-full object-contain" />
      ) : (
        <span className="text-[9px] font-bold tracking-wide text-[var(--reader-text-subtle)]">{(item.ext || "file").toUpperCase()}</span>
      )}
    </span>
  );
}

function Row({
  item: it,
  onEdit,
  onSave,
  onRetry,
  onRemove,
}: {
  item: Item;
  onEdit: (it: Item, field: "title" | "author", value: string) => void;
  onSave: (it: Item) => void;
  onRetry: (it: Item) => void;
  onRemove: (it: Item) => void;
}) {
  const busy = ACTIVE.includes(it.status);
  const editable = it.status !== "skipped" && it.status !== "cancelled";
  const showBar = it.status === "downloading" || it.status === "uploading";
  const field =
    "w-full -ml-[7px] rounded-sm border border-transparent bg-transparent px-1.5 py-px outline-none hover:border-[var(--reader-border)] focus:border-[var(--reader-text-subtle)] focus:bg-[var(--reader-surface)]";
  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-[var(--reader-border)] py-3.5 ${it.status === "failed" ? "bg-brand-50/55" : ""}`}>
      <Cover item={it} className="h-[60px] w-10" />
      <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-px">
        {editable ? (
          <>
            <input
              value={it.title}
              onChange={(e) => onEdit(it, "title", e.target.value)}
              onBlur={() => onSave(it)}
              aria-label="Title"
              className={`${field} truncate font-serif text-[16px] leading-snug font-semibold text-[var(--reader-text)]`}
            />
            <input
              value={it.author}
              onChange={(e) => onEdit(it, "author", e.target.value)}
              onBlur={() => onSave(it)}
              placeholder="Add author"
              aria-label="Author"
              className={`${field} text-[13px] font-semibold text-[var(--reader-text-muted)] placeholder:text-[var(--reader-text-subtle)]`}
            />
          </>
        ) : (
          <span className="truncate font-serif text-[16px] leading-snug font-semibold text-[var(--reader-text-muted)]">{it.title}</span>
        )}
        <span title={it.name} className="mt-0.5 truncate text-[12px] text-[var(--reader-text-subtle)]">
          <span className="hidden text-[var(--reader-text-muted)] sm:inline">{it.where}</span>
          {it.name}
        </span>
      </div>
      <div className="order-3 flex min-w-0 flex-[1_1_100%] flex-col gap-1.5 pl-14 sm:order-1 sm:flex-[0_0_240px] sm:pl-0">
        <div className={`flex items-center gap-2 text-[13px] font-semibold ${it.status === "failed" ? "text-brand-600" : busy || it.status === "added" ? "text-[var(--reader-text)]" : "text-[var(--reader-text-subtle)]"}`}>
          <span className={`h-2 w-2 flex-none rounded-full ${DOT[it.status]}`} />
          <span>{LABEL[it.status]}</span>
          {showBar && <span className="font-medium text-[var(--reader-text-subtle)]">{Math.floor(it.progress * 100)}%</span>}
          {it.status === "added" && it.slug && (
            <Link href={`/book/${it.slug}`} className="ml-auto text-[13px] text-brand-500">
              View book
            </Link>
          )}
          {it.status === "failed" && (
            <button type="button" onClick={() => onRetry(it)} className="ml-auto h-[30px] cursor-pointer rounded-sm border border-brand-500 bg-transparent px-3 text-[13px] font-bold text-brand-500 hover:bg-brand-50">
              Retry
            </button>
          )}
          {it.status === "skipped" && it.duplicate && (
            <button type="button" onClick={() => onRetry(it)} className="ml-auto h-[30px] cursor-pointer rounded-sm border border-[var(--reader-border)] bg-transparent px-3 text-[13px] font-bold text-[var(--reader-text)] hover:bg-[var(--reader-surface-hover)]">
              Add anyway
            </button>
          )}
        </div>
        {showBar && (
          <div className="h-1 overflow-hidden rounded-full bg-[var(--reader-surface-hover)]">
            <div className="h-full bg-brand-500 transition-[width] duration-200" style={{ width: `${it.progress * 100}%` }} />
          </div>
        )}
        {it.note && (it.status === "skipped" || it.status === "failed" || it.status === "downloading" || it.status === "added") && <span className="pl-4 text-[12px] text-[var(--reader-text-muted)]">{it.note}</span>}
      </div>
      <button
        type="button"
        onClick={() => onRemove(it)}
        disabled={it.note === "Deleting…"}
        aria-label={it.status === "added" ? "Delete this book" : busy || it.status === "queued" ? "Stop and remove" : "Remove from list"}
        title={it.status === "added" ? "Delete this book" : busy || it.status === "queued" ? "Stop and remove" : "Remove from list"}
        className="order-2 flex h-8 w-8 flex-none cursor-pointer items-center justify-center rounded-sm border-none bg-transparent text-[var(--reader-text-subtle)] hover:bg-[var(--reader-surface-hover)] hover:text-[var(--reader-text)] disabled:cursor-default disabled:opacity-40"
      >
        <X size={16} />
      </button>
    </li>
  );
}
