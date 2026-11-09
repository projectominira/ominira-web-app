/**
 * Reads a public ("anyone with the link") Google Drive folder from the
 * browser: lists its files, subfolders included, and downloads each one as a
 * File for useUploadBook — so a Drive import goes through exactly the same
 * parse -> sign -> PUT to R2 -> finalize path as a dropped file, and no
 * bytes pass through our API. The Drive API allows CORS; the key is a
 * browser key restricted to the Drive API and our domains.
 */
const DRIVE = "https://www.googleapis.com/drive/v3/files";
const KEY = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_KEY ?? "";
const FOLDER = "application/vnd.google-apps.folder";
const GOOGLE_DOC = "application/vnd.google-apps.document";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type DriveFile = { id: string; name: string; mimeType: string; size: number; /** "Sub/folder/" it sits in, "" at the top. */ folder: string };

/** The folder id in a Drive folder link, or null if it isn't one. */
export function driveFolderId(url: string): string | null {
  const m = url.match(/drive\.google\.com\/.*?(?:\/folders\/|[?&]id=)([\w-]{10,})/);
  return m?.[1] ?? null;
}

/** Why Drive refused: "private" is a folder that isn't shared publicly. */
export class DriveError extends Error {
  constructor(readonly kind: "private" | "other", message: string) {
    super(message);
  }
}

/** Drive's per-request reason, e.g. "rateLimitExceeded" or "notFound". */
async function reason(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { errors?: { reason?: string }[]; status?: string } };
    return body.error?.errors?.[0]?.reason ?? body.error?.status ?? "";
  } catch {
    return "";
  }
}

const RATE_LIMITED = new Set(["rateLimitExceeded", "userRateLimitExceeded", "RESOURCE_EXHAUSTED"]);

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (clearTimeout(t), reject(signal.reason)), { once: true });
  });

/** How long to hold off after each throttled attempt in a row: short at
 * first for a blip, then long enough for Drive's limit to lift. */
const COOLDOWN = [30, 60, 120, 300, 600, 900].map((s) => s * 1000);

/** Drive throttles a burst of downloads with 429, a 403 rate-limit reason,
 * or (when the throttle reply has no CORS header) a bare network error the
 * browser reports as "Failed to fetch". Those and 5xx are retried; a real
 * sharing problem is not. With `onWait` (a download) it waits out the limit
 * for as long as it takes, telling the caller when it will try again (null
 * once it does); without (listing a folder) it gives up after a few tries. */
async function drive(path: string, signal?: AbortSignal, onWait?: (until: Date | null) => void): Promise<Response> {
  const url = `${DRIVE}${path}${path.includes("?") ? "&" : "?"}key=${KEY}&supportsAllDrives=true`;
  for (let attempt = 0; ; attempt++) {
    let res: Response | null = null;
    let code: string;
    let retry: boolean;
    let why = "";
    try {
      res = await fetch(url, { signal });
    } catch (err) {
      if (signal?.aborted) throw err;
    }
    if (res?.ok) {
      if (attempt) onWait?.(null);
      return res;
    }
    if (res) {
      why = res.status === 404 ? "notFound" : await reason(res);
      retry = res.status === 429 || res.status >= 500 || RATE_LIMITED.has(why);
      code = `${res.status}${why ? ` ${why}` : ""}`;
    } else {
      retry = true;
      code = "network error, likely throttled";
    }
    if (retry && (onWait || attempt < 3)) {
      const ms = COOLDOWN[Math.min(attempt, COOLDOWN.length - 1)];
      console.warn(`Google Drive: ${code} on ${path}; retry ${attempt + 1} in ${ms / 1000}s`);
      onWait?.(new Date(Date.now() + ms));
      await wait(ms, signal);
      continue;
    }
    console.warn(`Google Drive refused ${path} after ${attempt + 1} attempt(s): ${code}`);
    if (why === "downloadQuotaExceeded") throw new DriveError("other", `Google Drive’s download limit for this file is reached. Try again later. (${code})`);
    if (retry) throw new DriveError("other", `Google Drive is limiting requests. Try again in a few minutes. (${code})`);
    if (res!.status === 404 || res!.status === 403) throw new DriveError("private", `This file isn't shared publicly. (${code})`);
    throw new DriveError("other", `Google Drive refused the request. (${code})`);
  }
}

/** The folder's own name. */
export async function driveFolderName(folderId: string, signal?: AbortSignal): Promise<string> {
  return ((await (await drive(`/${folderId}?fields=name`, signal)).json()) as { name: string }).name;
}

/** Every file in the folder and its subfolders. */
export async function listDriveFolder(folderId: string, signal?: AbortSignal, folder = ""): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  let pageToken = "";
  do {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const page = (await (
      await drive(`?q=${q}&pageSize=1000&includeItemsFromAllDrives=true&orderBy=name&fields=nextPageToken,files(id,name,mimeType,size)${pageToken && `&pageToken=${pageToken}`}`, signal)
    ).json()) as { files: { id: string; name: string; mimeType: string; size?: string }[]; nextPageToken?: string };
    for (const f of page.files) {
      if (f.mimeType === FOLDER) out.push(...(await listDriveFolder(f.id, signal, `${folder}${f.name}/`)));
      else out.push({ id: f.id, name: f.mimeType === GOOGLE_DOC ? `${f.name}.docx` : f.name, mimeType: f.mimeType, size: Number(f.size ?? 0), folder });
    }
    pageToken = page.nextPageToken ?? "";
  } while (pageToken);
  return out;
}

/** One Drive download at a time, however many uploads run: Drive throttles
 * bursts of anonymous downloads well below its published request quota. */
const DOWNLOADS = 1;
let downloading = 0;
const waiting: (() => void)[] = [];

/** Downloads one file (a Google Doc is exported as DOCX), reporting the
 * fraction received when Drive sends a length. While Drive's rate limit
 * holds, it waits (the queue behind it with it) rather than failing, and
 * `onWait` says until when. */
export async function downloadDriveFile(f: DriveFile, onProgress?: (fraction: number) => void, signal?: AbortSignal, onWait?: (until: Date | null) => void): Promise<File> {
  if (downloading >= DOWNLOADS) await new Promise<void>((resolve) => waiting.push(resolve));
  downloading++;
  try {
    return await fetchDriveFile(f, onProgress, signal, onWait);
  } finally {
    downloading--;
    waiting.shift()?.();
  }
}

async function fetchDriveFile(f: DriveFile, onProgress?: (fraction: number) => void, signal?: AbortSignal, onWait?: (until: Date | null) => void): Promise<File> {
  const isDoc = f.mimeType === GOOGLE_DOC;
  const res = await drive(isDoc ? `/${f.id}/export?mimeType=${encodeURIComponent(DOCX)}` : `/${f.id}?alt=media`, signal, onWait);
  const total = Number(res.headers.get("content-length")) || f.size;
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let received = 0;
  const reader = res.body!.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    if (total) onProgress?.(Math.min(1, received / total));
  }
  return new File(chunks, f.name, { type: isDoc ? DOCX : f.mimeType });
}
