// Shared TanStack Query keys for a material's own notes (highlights being
// the empty ones) — one place so a mutation (create/edit/delete note) and
// the query it should invalidate never drift onto slightly different
// key arrays.
export const materialKeys = {
  notes: (materialId: string) => ["materials", materialId, "notes"] as const,
  // Lines comrades marked (rooms-spec §5.4), read with the notes.
  marks: (materialId: string) => ["materials", materialId, "marks"] as const,
  // The old book details page's notes tab (retired by the book room,
  // rooms-tasks 4.1). Nothing reads it now; useNoteMutations still
  // invalidates and patches it until 7.1 retires it with them.
  notesFeedPrefix: (materialId: string) => ["materials", materialId, "notes-feed"] as const,
  currentReaders: (materialId: string) => ["materials", materialId, "current-readers"] as const,
  room: (materialId: string) => ["materials", materialId, "room"] as const,
  // The book room's stream (rooms-spec §5.1), per viewer like the group's.
  stream: (materialId: string, readerId: string | null) => ["materials", materialId, "stream", readerId] as const,
  streamPrefix: (materialId: string) => ["materials", materialId, "stream"] as const,
  // The reader's book room head: the cover, and the group your note on it
  // also shows in (rooms-spec §5.3), per viewer.
  readerRoom: (materialId: string, readerId: string | null) => ["materials", materialId, "reader-room", readerId] as const,
  // Its contents and spine (fields=sections,spine): a group target's chapter ends.
  outline: (materialId: string) => ["materials", materialId, "outline"] as const,
};
