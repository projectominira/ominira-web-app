/**
 * Reads a shared Google Drive folder from the browser: lists its files,
 * subfolders included, and downloads each one as a File for useUploadBook —
 * so a Drive import goes through exactly the same parse -> sign -> PUT to R2
 * -> finalize path as a dropped file, and no bytes pass through our API.
 *
 * Requests carry the admin's own Google sign-in (read-only Drive access via
 * Google Identity Services), not an API key: Drive's abuse filter blocks a
 * run of anonymous key-only downloads by IP after a couple of dozen files,
 * answering with an HTML page the browser can't even read (no CORS header).
 * The sign-in's refresh token stays on our server (/api/admin/drive/token),
 * which hands out a new hour-long access token whenever one runs out, so an
 * import of any length needs one sign-in.
 */
const DRIVE = "https://www.googleapis.com/drive/v3/files";
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const SCOPE = "https://www.googleapis.com/auth/drive.readonly";
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
  constructor(readonly kind: "private" | "signin" | "other", message: string) {
    super(message);
  }
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initCodeClient(config: {
            client_id: string;
            scope: string;
            ux_mode: "popup";
            callback: (r: { code?: string; error_description?: string }) => void;
            error_callback?: (e: { type: string }) => void;
          }): { requestCode(): void };
        };
      };
    };
  }
}

const TOKEN_ROUTE = "/api/admin/drive/token";
let token = "";
let expires = 0;
let refreshing: Promise<boolean> | null = null;
let gis: Promise<void> | null = null;
let onSignInNeeded: ((needed: boolean) => void) | null = null;
const signInWaiters: (() => void)[] = [];

function keep(r: { accessToken: string; expiresIn: number }) {
  token = r.accessToken;
  expires = Date.now() + r.expiresIn * 1000;
}

/** Loads Google's sign-in script. Call on mount, so the popup can open
 * straight from the click (browsers block popups opened later). */
export function preloadDriveSignIn(): Promise<void> {
  return (gis ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      gis = null;
      reject(new DriveError("signin", "Couldn’t load Google sign-in."));
    };
    document.head.appendChild(s);
  }));
}

/** A new access token from the sign-in kept on our server (an
 * /api/admin/drive/token cookie), with no popup. False when there's none. */
export function refreshDrive(): Promise<boolean> {
  return (refreshing ??= fetch(TOKEN_ROUTE)
    .then(async (res) => (res.ok ? (keep(await res.json()), true) : false))
    .catch(() => false)
    .finally(() => (refreshing = null)));
}

/** True while the Google token has over a minute left. */
export const driveSignedIn = () => !!token && Date.now() < expires - 60_000;

/** Opens Google's sign-in popup (call it from a click). The server keeps
 * the sign-in, so later tokens come without a popup; downloads waiting on
 * a sign-in carry on once it's done. */
export async function connectDrive(): Promise<void> {
  await preloadDriveSignIn();
  const code = await new Promise<string>((resolve, reject) =>
    window.google!.accounts.oauth2
      .initCodeClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        ux_mode: "popup",
        callback: (r) => (r.code ? resolve(r.code) : reject(new DriveError("signin", r.error_description || "Google sign-in was refused."))),
        error_callback: (e) => reject(new DriveError("signin", e.type === "popup_closed" ? "Google sign-in was closed." : `Google sign-in failed (${e.type}).`)),
      })
      .requestCode()
  );
  const res = await fetch(TOKEN_ROUTE, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
  if (!res.ok) throw new DriveError("signin", "Google sign-in was refused.");
  keep(await res.json());
  onSignInNeeded?.(false);
  for (const resume of signInWaiters.splice(0)) resume();
}

/** Tells the page when no token can be had without the admin (the kept
 * sign-in was revoked or ran out) and an import is waiting on a sign-in. */
export function watchDriveSignIn(cb: (needed: boolean) => void): () => void {
  onSignInNeeded = cb;
  return () => {
    if (onSignInNeeded === cb) onSignInNeeded = null;
  };
}

async function signedIn(signal?: AbortSignal): Promise<void> {
  if (driveSignedIn() || (await refreshDrive())) return;
  if (!onSignInNeeded) throw new DriveError("signin", "Sign in with Google first.");
  onSignInNeeded(true);
  await new Promise<void>((resolve, reject) => {
    signInWaiters.push(resolve);
    signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
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

/** Google's truncated exponential backoff for Drive: wait
 * min(2^n s + up to 1 s of jitter, 64 s) before retry n, then keep retrying
 * every 64 s. Drive quotas are per-minute windows, so longer waits only
 * lose time. developers.google.com/workspace/drive/api/guides/limits#exponential */
const MAX_BACKOFF = 64_000;
const backoff = (n: number) => Math.min(2 ** n * 1000 + Math.random() * 1000, MAX_BACKOFF);

/** Drive throttles a burst of downloads with 429, a 403 rate-limit reason,
 * or (when the throttle reply has no CORS header) a bare network error the
 * browser reports as "Failed to fetch". Those and 5xx are retried; a real
 * sharing problem is not. With `onWait` (a download) it waits out the limit
 * for as long as it takes, telling the caller when it will try again (null
 * once it does); without (listing a folder) it gives up after a few tries. */
async function drive(path: string, signal?: AbortSignal, onWait?: (until: Date | null) => void): Promise<Response> {
  const url = `${DRIVE}${path}${path.includes("?") ? "&" : "?"}supportsAllDrives=true`;
  for (let attempt = 0; ; attempt++) {
    let res: Response | null = null;
    let code: string;
    let retry: boolean;
    let why = "";
    await signedIn(signal);
    try {
      res = await fetch(url, { signal, headers: { Authorization: `Bearer ${token}` } });
    } catch (err) {
      if (signal?.aborted) throw err;
    }
    // The token expired or was revoked: wait for a fresh sign-in.
    if (res?.status === 401) {
      token = "";
      attempt = -1;
      continue;
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
    if (retry && (onWait || attempt < 5)) {
      const ms = backoff(attempt);
      console.warn(`Google Drive: ${code} on ${path}; retry ${attempt + 1} in ${Math.round(ms / 1000)}s`);
      onWait?.(new Date(Date.now() + ms));
      await wait(ms, signal);
      continue;
    }
    console.warn(`Google Drive refused ${path} after ${attempt + 1} attempt(s): ${code}`);
    if (why === "downloadQuotaExceeded") throw new DriveError("other", `Google Drive’s download limit for this file is reached. Try again later. (${code})`);
    if (retry) throw new DriveError("other", `Google Drive is limiting requests. Try again in a few minutes. (${code})`);
    if (res!.status === 404 || res!.status === 403) throw new DriveError("private", `This file isn't shared with your Google account. (${code})`);
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
