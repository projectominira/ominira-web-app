import { PLATFORM_NAME, PLATFORM_URL } from "@/lib/config/platform";
import { APP_ICON } from "@/lib/config/brand-assets";

export const ANNOUNCEMENT_FROM_ADDRESS = "cadres@projectominira.org";
export const ANNOUNCEMENT_FROM = `${PLATFORM_NAME} <${ANNOUNCEMENT_FROM_ADDRESS}>`;

const BRAND = "#be400d"; // --color-brand-500
const INK = "#2b2622";
const FAINT = "#8a817a";
const RULE = "#eee6dc";
const SERIF = "Georgia,'Times New Roman',serif";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** In-app paths become absolute — an email has no origin to resolve against. */
export const absoluteUrl = (url: string) => (url.startsWith("/") ? `${PLATFORM_URL}${url}` : url);

const FOOTER = `You're getting this as an ${PLATFORM_NAME} member.`;

/** Blank lines become paragraphs. */
const paragraphs = (text: string, size = 16) =>
  text
    .trim()
    .split(/\n\s*\n/)
    .map((p) => `<p style="margin:0 0 16px;font-size:${size}px;line-height:1.6;color:${INK}">${escapeHtml(p.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");

const button = (url: string, label: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="background:${BRAND};border-radius:6px">
<a href="${escapeHtml(absoluteUrl(url))}" style="display:inline-block;padding:12px 20px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none">${escapeHtml(label)}</a>
</td></tr></table>`;

/** The page every email shares: logo card, preheader, unsubscribe footer.
 * Table layout + inline styles: what email clients reliably render. */
function frame({ title, preheader, inner, unsubscribeUrl }: { title: string; preheader: string; inner: string; unsubscribeUrl: string }) {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f6f3ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader.trim().slice(0, 140))}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f3ef;padding:32px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;border:1px solid #e8e2da">
<tr><td style="padding:28px 28px 0">
<img src="${PLATFORM_URL}${APP_ICON}" width="36" height="36" alt="${escapeHtml(PLATFORM_NAME)}" style="display:block;border-radius:8px">
</td></tr>
<tr><td style="padding:20px 28px 8px">
${inner}
</td></tr>
</table>
<p style="max-width:560px;margin:16px auto 0;font-size:12px;line-height:1.6;color:${FAINT};text-align:center">
${escapeHtml(FOOTER)}<br>
<a href="${escapeHtml(unsubscribeUrl)}" style="color:${FAINT}">Unsubscribe</a>
</p>
</td></tr>
</table>
</body>
</html>`;
}

const textFooter = (unsubscribeUrl: string) => `\n\n—\n${FOOTER}\nUnsubscribe: ${unsubscribeUrl}\n`;

export type EmailBook = { title: string; author: string; tag: string | null; why: string; cover: string | null; /** Its page in the library. */ url: string };

/** A book row: cover, label, title, author, the editor's lines and a link to
 * its page; the cover and title link there too. */
function bookRow(b: EmailBook) {
  const href = escapeHtml(absoluteUrl(b.url));
  const cover = b.cover
    ? `<td width="64" valign="top" style="padding:0 16px 0 0"><a href="${href}"><img src="${escapeHtml(b.cover)}" width="64" height="96" alt="" style="display:block;width:64px;height:96px;object-fit:cover;border-radius:3px;background:#eeeeee;border:0"></a></td>`
    : "";
  const tag = b.tag ? `<div style="font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:${BRAND};margin:0 0 4px">${escapeHtml(b.tag)}</div>` : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${RULE}"><tr><td style="padding:18px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${cover}<td valign="top">
${tag}<a href="${href}" style="font-family:${SERIF};font-size:17px;font-weight:700;line-height:1.3;color:#1c1917;text-decoration:none">${escapeHtml(b.title)}</a>
<div style="font-size:13px;color:${FAINT};margin:2px 0 6px">${escapeHtml(b.author)}</div>
<div style="font-size:14px;line-height:1.55;color:${INK}">${escapeHtml(b.why)}</div>
<a href="${href}" style="display:inline-block;margin-top:10px;font-size:13px;font-weight:700;color:${BRAND};text-decoration:none">Start reading &rarr;</a>
</td></tr></table>
</td></tr></table>`;
}

/**
 * One announcement, rendered for one recipient (only the unsubscribe link
 * differs): the title, the message, then, when it links to a reading list,
 * the list's books. No `url` means no button.
 */
export function renderAnnouncement({ title, body, url, books = [], unsubscribeUrl }: { title: string; body: string; url: string; books?: EmailBook[]; unsubscribeUrl: string }): { html: string; text: string } {
  const label = books.length ? `Read the list on ${PLATFORM_NAME}` : `Open in ${PLATFORM_NAME}`;
  const inner = `<h1 style="margin:0 0 16px;font-family:${SERIF};font-size:24px;line-height:1.3;color:#1c1917">${escapeHtml(title)}</h1>
${paragraphs(body)}
${books.map(bookRow).join("")}
${url ? `<div style="${books.length ? `border-top:1px solid ${RULE};padding-top:20px` : ""}">${button(url, label)}</div>` : `<div style="height:8px"></div>`}`;
  const textBooks = books.length ? `\n\n${books.map((b, i) => `${i + 1}. ${b.title}, ${b.author}${b.tag ? ` (${b.tag})` : ""}\n${b.why}\nStart reading: ${absoluteUrl(b.url)}`).join("\n\n")}` : "";
  const link = url ? `\n\n${label}: ${absoluteUrl(url)}` : "";
  return {
    html: frame({ title, preheader: body, inner, unsubscribeUrl }),
    text: `${title}\n\n${body.trim()}${textBooks}${link}${textFooter(unsubscribeUrl)}`,
  };
}
