import { redirect } from "next/navigation";
import { readingListHref } from "@/lib/groups/copy";

/** The reading list is a tab on the group page now; old links land there. */
export default async function GroupReadingListPage({ params }: { params: Promise<{ slug: string }> }) {
  redirect(readingListHref((await params).slug));
}
