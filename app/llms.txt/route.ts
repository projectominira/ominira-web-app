import { PLATFORM_URL } from "@/lib/config/platform";
import { listTopics } from "@/lib/topics/guides";
import { listReadingLists, monthLabel } from "@/lib/readingLists/lists";

// What Ominira is, for AI assistants (seo-spec.md §7, T5): the hubs and every
// topic page and reading list.
export const revalidate = 3600;

export async function GET() {
  const [topics, lists] = await Promise.all([
    listTopics(),
    listReadingLists().catch((err) => (console.error("[llms.txt] reading lists", err), [])),
  ]);
  const body = `# Ominira

> Ominira is an online library and reading community for Pan-Africanist, anti-colonial and African liberation books. Members read or listen to every book, with narration in African voices, and share notes on what they read.

The library holds over a thousand books: Pan-African political thought, African and Caribbean history, liberation movements, Black radical thought, Marxism and anti-imperialism, and African literature. Each book has its own page with its author, a description and a link to read or listen.

## Main pages

- [Library](${PLATFORM_URL}/library): every book, by category
${lists.length ? `- [Reading lists](${PLATFORM_URL}/reading-lists): a list each month from the editors, with where to start and why each book is there\n` : ""}- [Topics](${PLATFORM_URL}/topics): reading guides to each topic and collection, with the books in order and why each matters
- [Authors](${PLATFORM_URL}/authors): the library's authors, each with a short biography, their books and quotes
- [Quotes](${PLATFORM_URL}/quotes): quotes from the library's books, each word for word from the page, by topic and author
- [Home](${PLATFORM_URL}/): what Ominira is
- [Sitemap](${PLATFORM_URL}/sitemap.xml): every book page

## Topics

${topics.map((t) => `- [${t.guide ? t.title : t.name}](${PLATFORM_URL}/topics/${t.slug}): ${t.books} books`).join("\n")}
${lists.length ? `\n## Reading lists\n\n${lists.map((l) => `- [${l.title}](${PLATFORM_URL}/reading-lists/${l.slug}): ${monthLabel(l.day)}, ${l.books} books`).join("\n")}\n` : ""}`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
