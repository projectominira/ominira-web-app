import { NextResponse, userAgent, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/admin/pin";
import { getSupabaseAdminClient } from "@/lib/supabase/adminClient";
import { slugifyCategory } from "@/lib/categories/slug";

const BOOK_PATH = /^\/(library|read|reader)\/([a-z0-9-]+)$/;
const AUTHOR_PATH = /^\/(authors|quotes)\/([a-z0-9-]+)$/;
const TOPIC_PATH = /^\/topics\/([a-z0-9-]+)$/;
const LIST_PATH = /^\/reading-lists\/([a-z0-9-]+)$/;

const notFound = () =>
  new NextResponse("<!doctype html><title>Not found</title><h1>This page doesn't exist</h1>", {
    status: 404,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });

/**
 * Book URLs, for search crawlers only: a real 404 for a slug no book has and
 * a 308 for a renamed book's old slug (seo-spec.md T2, T6). The pages
 * themselves can't: the loading.tsx shells stream a 200 before the page
 * knows the book is missing. Members skip the query; their pages already
 * show not-found (noindex) or redirect in the browser.
 */
async function crawlerBookCheck(request: NextRequest, route: string, slug: string) {
  const { data, error } = await getSupabaseAdminClient()
    .from("materials")
    .select("slug")
    .eq("status", "published")
    .or(`slug.eq.${slug},old_slugs.cs.{${slug}}`)
    .limit(2);
  // Never 404 a crawler because the lookup failed; the page renders as usual.
  if (error || !data) return NextResponse.next();
  if (data.some((b) => b.slug === slug)) return NextResponse.next();
  if (data[0]) {
    const to = new URL(`/${route}/${data[0].slug}${request.nextUrl.search}`, request.url);
    return NextResponse.redirect(to, 308);
  }
  return notFound();
}

/** The same for author pages and authors' quotes (seo-spec C2, C4). */
async function crawlerAuthorCheck(slug: string) {
  const { data, error } = await getSupabaseAdminClient().from("authors").select("id").eq("slug", slug).maybeSingle();
  return error || data ? NextResponse.next() : notFound();
}

/** The same for topic pages (seo-spec C3): an approved guide, or a category
 * (matched as lib/categories/slug.ts slugifies it). */
async function crawlerTopicCheck(slug: string) {
  const db = getSupabaseAdminClient();
  const [guide, categories] = await Promise.all([
    db.from("topic_guides").select("status, category").eq("slug", slug).maybeSingle(),
    db.from("categories").select("name"),
  ]);
  if (guide.error || categories.error) return NextResponse.next();
  if (guide.data?.status === "approved" || guide.data?.category) return NextResponse.next();
  return categories.data.some((c) => slugifyCategory(c.name) === slug) ? NextResponse.next() : notFound();
}

/** The same for reading lists (seo-spec C1): approved and its day come.
 * The 07:00 Lagos hour is the page's to check; a crawler early that morning
 * gets the page's own not-found. */
async function crawlerListCheck(slug: string) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
  const { data, error } = await getSupabaseAdminClient().from("reading_lists").select("id").eq("slug", slug).eq("status", "approved").lte("day", today).maybeSingle();
  return error || data ? NextResponse.next() : notFound();
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const book = BOOK_PATH.exec(pathname);
  if (book) return userAgent(request).isBot ? crawlerBookCheck(request, book[1], book[2]) : NextResponse.next();
  const author = AUTHOR_PATH.exec(pathname);
  if (author) return userAgent(request).isBot ? crawlerAuthorCheck(author[2]) : NextResponse.next();
  const topic = TOPIC_PATH.exec(pathname);
  if (topic) return userAgent(request).isBot ? crawlerTopicCheck(topic[1]) : NextResponse.next();
  const list = LIST_PATH.exec(pathname);
  if (list) return userAgent(request).isBot ? crawlerListCheck(list[1]) : NextResponse.next();

  /** PIN gate for every admin page and admin API route (lib/admin/pin.ts). */
  if (pathname === "/admin/unlock") return NextResponse.next();
  if (await verifyAdminSession(request.cookies.get(ADMIN_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Admin PIN required." }, { status: 401 });
  }
  const unlock = new URL("/admin/unlock", request.url);
  unlock.searchParams.set("next", pathname + search);
  return NextResponse.redirect(unlock);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/library/:slug", "/read/:slug", "/reader/:slug", "/authors/:slug", "/quotes/:slug", "/topics/:slug", "/reading-lists/:slug"],
};
