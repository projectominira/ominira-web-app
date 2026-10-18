import { apiFetch } from "@/lib/api/client";
import type {
  GroupBook,
  GroupMember,
  GroupPage,
  GroupRole,
  GroupSummary,
  SessionRepeat,
  SessionsView,
  TargetView,
} from "@/lib/groups/types";

// Client side of the membership routes (spec §9.1). Refusals arrive as
// ApiError: `forbidden` (not a moderator), `conflict` (last moderator).

export const getGroups = () => apiFetch<{ groups: GroupSummary[] }>("/groups").then((r) => r.groups);

export const createGroup = (input: { name: string; description: string }) =>
  apiFetch<{ slug: string }>("/groups", { method: "POST", json: input });

export const getGroup = (slug: string) => apiFetch<GroupPage>(`/groups/${slug}`);

export const getGroupMembers = (slug: string) =>
  apiFetch<{ members: GroupMember[] }>(`/groups/${slug}/members`).then((r) => r.members);

export const joinGroup = (slug: string) => apiFetch<void>(`/groups/${slug}/join`, { method: "POST" });

export const leaveGroup = (slug: string) => apiFetch<void>(`/groups/${slug}/leave`, { method: "POST" });

export const setMuted = (slug: string, muted: boolean) => apiFetch<void>(`/groups/${slug}/mute`, { method: "PUT", json: { muted } });

export const inviteToGroup = (slug: string, readerIds: string[]) =>
  apiFetch<void>(`/groups/${slug}/invite`, { method: "POST", json: { readerIds } });

export const setMemberRole = (slug: string, readerId: string, role: GroupRole) =>
  apiFetch<void>(`/groups/${slug}/members/${readerId}`, { method: "PATCH", json: { role } });

export const removeMember = (slug: string, readerId: string) =>
  apiFetch<void>(`/groups/${slug}/members/${readerId}`, { method: "DELETE" });

export const updateGroup = (slug: string, update: { name?: string; description?: string }) =>
  apiFetch<{ slug: string }>(`/groups/${slug}`, { method: "PATCH", json: update });

export const deleteGroup = (slug: string) => apiFetch<void>(`/groups/${slug}`, { method: "DELETE" });

export const getGroupBooks = (slug: string) => apiFetch<{ books: GroupBook[] }>(`/groups/${slug}/books`).then((r) => r.books);

export const addGroupBook = (slug: string, materialId: string) =>
  apiFetch<void>(`/groups/${slug}/books`, { method: "POST", json: { materialId } });

export type GroupBookUpdate = { status: "current" | "done" } | { startsOn: string | null; endsOn: string | null };

export const updateGroupBook = (slug: string, materialId: string, update: GroupBookUpdate) =>
  apiFetch<void>(`/groups/${slug}/books/${materialId}`, { method: "PATCH", json: update });

export const reorderGroupBooks = (slug: string, order: string[]) =>
  apiFetch<void>(`/groups/${slug}/books`, { method: "PUT", json: { order } });

export const removeGroupBook = (slug: string, materialId: string) =>
  apiFetch<void>(`/groups/${slug}/books/${materialId}`, { method: "DELETE" });


export const pinPost = (slug: string, postId: string | null) =>
  apiFetch<void>(`/groups/${slug}/pin`, { method: "PUT", json: { postId } });

/** Everyone who shares a group with you: the reader rail's "My group". */
export const getGroupComrades = () => apiFetch<{ readerIds: string[] }>("/auth/me/comrades").then((r) => r.readerIds);

export const getTarget = (slug: string) => apiFetch<TargetView>(`/groups/${slug}/target`);

export type TargetInput = {
  endPct: number;
  endLabel: string;
  endChapter: number | null;
  chapterCount: number | null;
  dueOn: string;
  notify: boolean;
};

export const setTarget = (slug: string, input: TargetInput) =>
  apiFetch<void>(`/groups/${slug}/target`, { method: "PUT", json: input });

export const clearTarget = (slug: string) => apiFetch<void>(`/groups/${slug}/target`, { method: "DELETE" });

export const getSessions = (slug: string) => apiFetch<SessionsView>(`/groups/${slug}/sessions`);

/** M8: `startsAt` is the instant (ISO), worked out from the day and time
 * where the moderator is. */
export type SessionInput = { topic: string; startsAt: string; repeat: SessionRepeat };

export const createSession = (slug: string, input: SessionInput) =>
  apiFetch<void>(`/groups/${slug}/sessions`, { method: "POST", json: input });

export const updateSession = (slug: string, id: string, input: SessionInput) =>
  apiFetch<void>(`/groups/${slug}/sessions/${id}`, { method: "PATCH", json: input });

/** Skip this one (`occurrence`), or end the weekly series (`series`). */
export const cancelSession = (slug: string, id: string, scope: "occurrence" | "series") =>
  apiFetch<void>(`/groups/${slug}/sessions/${id}?scope=${scope}`, { method: "DELETE" });

export const setSessionReminder = (slug: string, id: string, on: boolean) =>
  apiFetch<void>(`/groups/${slug}/sessions/${id}/remind`, { method: "PUT", json: { on } });
