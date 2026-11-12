import { PLATFORM_URL } from "@/lib/config/platform";
import { getCategories } from "@/lib/categories/config";
import { slugifyCategory } from "@/lib/categories/slug";

// What Ominira is, for AI assistants (seo-spec.md §7, T5). Hubs only; add
// authors, reading lists and topics here as those pages ship.
export const revalidate = 3600;

export async function GET() {
  const categories = await getCategories();
  const body = `# Ominira

> Ominira is an online library and reading community for Pan-Africanist, anti-colonial and African liberation books. Members read or listen to every book, with narration in African voices, and share notes on what they read.

The library holds over a thousand books: Pan-African political thought, African and Caribbean history, liberation movements, Black radical thought, Marxism and anti-imperialism, and African literature. Each book has its own page with its author, a description and a link to read or listen.

## Main pages

- [Library](${PLATFORM_URL}/library): every book, by category
- [Quotes](${PLATFORM_URL}/quotes): quotes from the library's books, each word for word from the page, by topic and author
- [Home](${PLATFORM_URL}/): what Ominira is
- [Sitemap](${PLATFORM_URL}/sitemap.xml): every book page

## Categories

${categories.map((c) => `- [${c}](${PLATFORM_URL}/library?q=${slugifyCategory(c)})`).join("\n")}
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
