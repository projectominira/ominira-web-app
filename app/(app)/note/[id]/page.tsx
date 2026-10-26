import type { Metadata } from "next";
import NoteView from "@/app/components/rooms/NoteView";

export const metadata: Metadata = {
  title: "Note",
  description: "A note from the community, with its replies.",
};

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <NoteView noteId={id} />;
}
