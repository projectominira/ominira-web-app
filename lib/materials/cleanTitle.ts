/**
 * Tidies a book title taken from a file name or from a file's own metadata:
 * drops the extension, shadow-library tags ("(Z-Library)", "z-lib.org",
 * "Anna's Archive", libgen), ISBNs, hashes and years, turns underscores and
 * dotted.names into spaces, and title-cases a title that is all lower or all
 * upper case. Also pulls an author out where the name format carries one:
 *   Anna's Archive  "Title -- Author -- Publisher, 2004 -- ISBN -- hash -- Anna's Archive"
 *   Z-Library       "Title (Author) (z-library.sk, 1lib.sk, z-lib.sk)"
 */
const JUNK = /z-?lib|1lib|z-?library|libgen|library genesis|anna.?s.?archive|b-ok|\bepub\b|\bpdf\b|\bmobi\b|\bretail\b|\bebook\b|www\.|\.(com|org|net|sk|se|rs)\b/i;
const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "from", "in", "into", "of", "on", "or", "the", "to", "with"]);

function titleCase(text: string): string {
  return text
    .toLowerCase()
    .split(" ")
    .map((word, i) => (i > 0 && SMALL_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

function tidy(text: string): string {
  let t = text
    .replace(/[([{][^)\]}]*[)\]}]/g, (group) => (JUNK.test(group) || /^.\s*\d{4}\s*.$/.test(group) ? " " : group))
    .replace(/\b(97[89][-\s]?)?\d[\d-]{8,}[\dXx]\b/g, " ") // ISBN-10/13
    .replace(/\b[0-9a-f]{32}\b/gi, " ") // MD5
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—_,.:;]+|[\s\-–—_,.:;]+$/g, "");
  if (t && (t === t.toLowerCase() || t === t.toUpperCase()) && /[a-z]/i.test(t)) t = titleCase(t);
  return t;
}

/** Tidies a catalogue-style author: drops life dates ("1933-", "1915-2004",
 * "b. 1933") and roles ("author", "editor", "translator"), and turns the
 * commas into spaces — "Richards, Roosevelt, 1933- author" -> "Richards
 * Roosevelt". Several authors split by ";" stay ", "-separated. */
export function cleanAuthor(raw: string): string {
  return raw
    .split(/\s*;\s*/)
    .map((name) =>
      tidy(
        name
          .replace(/\b(b\.|d\.|ca?\.|fl\.)?\s*\d{3,4}\??\s*[-–]\s*(\d{3,4}\??)?/gi, " ")
          .replace(/\b(b\.|born|d\.|died)\s*\d{3,4}\b/gi, " ")
          .replace(/\b(author|editor|ed\.|eds\.|translator|trans\.|illustrator|compiler|contributor|writer of (introduction|foreword))\b\.?/gi, " ")
          .replace(/,/g, " ")
      )
    )
    .filter(Boolean)
    .join(", ");
}

export function cleanTitle(raw: string): { title: string; author: string | null } {
  let t = raw.trim().replace(/\.(epub|pdf|docx?|mobi|azw3?)$/i, "");
  t = t.replace(/_+/g, " ");
  if (!/\s/.test(t) && /\w\.\w/.test(t)) t = t.replace(/\./g, " ");
  let author: string | null = null;

  // Anna's Archive: fields separated by " -- ".
  const fields = t.split(/\s+--\s+/);
  if (fields.length >= 3) {
    t = fields[0];
    author = cleanAuthor(fields[1]) || null;
  } else {
    // Z-Library: drop the tag group, then a trailing "(Author)" is the author.
    t = t.replace(/\s*\([^)]*\)\s*$/, (group) => (JUNK.test(group) ? "" : group));
    const trailing = t.match(/^(.*\S)\s*\(([^()]+)\)\s*$/);
    // "(Aptheker, Herbert, 1915-)": an author may carry life dates.
    const name = trailing && !JUNK.test(trailing[2]) ? cleanAuthor(trailing[2]) : "";
    if (trailing && name && !/\d/.test(name)) {
      t = trailing[1];
      author = name;
    }
  }
  return { title: tidy(t), author };
}

/** A metadata title that is really a placeholder ("Microsoft Word - x.doc",
 * "untitled", a file name), not worth preferring over the file's name. */
export function isPlaceholderTitle(title: string | null | undefined): boolean {
  const t = (title ?? "").trim();
  return t.length < 2 || /^(untitled|unknown|microsoft word\b|document\d*$)/i.test(t) || /\.(docx?|pdf|epub|indd|qxd)$/i.test(t) || /^[\d\s_-]+$/.test(t);
}

/** The title and author to file a book under: its own metadata title unless
 * that's a placeholder, else its file name — either way cleaned — and its
 * metadata author, else one carried in the file name. */
export function bookTitle(fileName: string, metaTitle?: string | null, metaAuthor?: string | null): { title: string; author: string } {
  const fromName = cleanTitle(fileName);
  const title = (!isPlaceholderTitle(metaTitle) && cleanTitle(metaTitle!).title) || fromName.title || fileName;
  return { title, author: cleanAuthor(metaAuthor ?? "") || fromName.author || "" };
}
