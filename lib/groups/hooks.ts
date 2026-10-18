"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import * as api from "@/lib/groups/api";
import { groupKeys } from "@/lib/groups/queryKeys";
import { communityKeys } from "@/lib/community/queryKeys";
import { materialKeys } from "@/lib/materials/queryKeys";
import { homeKey } from "@/lib/rooms/useHome";
import { apiFetch } from "@/lib/api/client";
import { chapterEnds } from "@/lib/groups/progress";
import { groupHref } from "@/lib/groups/copy";
import { reminderKey } from "@/lib/groups/sessions";
import type { TocSection } from "@/lib/api/types";
import { setPendingJoin } from "@/lib/groups/pendingJoin";
import type { GroupBook, GroupPage, GroupRole, GroupSession, SessionsView } from "@/lib/groups/types";
import { useIsAuthenticated } from "@/lib/auth/useIsAuthenticated";
import { useSessionStore } from "@/stores/session-store";

/** Public reads that depend on the viewer wait for session hydration, so the
 * first fetch already knows who's asking (same as useReaderProfile). */
function useViewer() {
  const hasHydrated = useSessionStore((s) => s.hasHydrated);
  const readerId = useSessionStore((s) => s.readerId);
  return { hasHydrated, readerId };
}

/** Every group with `joined`: the home card, Library row and sidebar. */
export function useGroups() {
  const { hasHydrated, readerId } = useViewer();
  return useQuery({ queryKey: groupKeys.list(readerId), queryFn: api.getGroups, enabled: hasHydrated });
}

/** The page header. */
export function useGroup(slug: string) {
  const { hasHydrated, readerId } = useViewer();
  return useQuery({ queryKey: groupKeys.page(slug, readerId), queryFn: () => api.getGroup(slug), enabled: hasHydrated });
}

export function useGroupMembers(slug: string, enabled = true) {
  return useQuery({ queryKey: groupKeys.members(slug), queryFn: () => api.getGroupMembers(slug), enabled });
}

/** This week's target with the group's progress: the card, the Schedule's
 * day rows, the Members tab's words and M7, from one call. */
export function useGroupTarget(slug: string) {
  const { hasHydrated, readerId } = useViewer();
  return useQuery({ queryKey: groupKeys.target(slug, readerId), queryFn: () => api.getTarget(slug), enabled: hasHydrated });
}

/** Upcoming and past sessions with the viewer's Remind me and attendance,
 * and the live room: the session card, the Schedule, M8, M11 and Manage. */
export function useGroupSessions(slug: string) {
  const { hasHydrated, readerId } = useViewer();
  return useQuery({
    queryKey: groupKeys.sessions(slug, readerId),
    queryFn: () => api.getSessions(slug),
    enabled: hasHydrated,
    // The live room's count and state stay roughly current while shown.
    refetchInterval: 60_000,
  });
}

/** The current book's chapter ends, for M7's "Read up to". Empty for a
 * book with no outline (then the target is a percentage). */
export function useChapterEnds(materialId: string | null) {
  return useQuery({
    queryKey: materialKeys.outline(materialId ?? ""),
    queryFn: () =>
      apiFetch<{ sections?: TocSection[]; spine?: string[] }>(`/materials/${materialId}?fields=sections,spine`).then(
        (m) => chapterEnds(m.sections ?? [], m.spine ?? []),
        // A PDF has no outline (no manifest): straight to the percent field,
        // not three retries of "Loading chapters…".
        () => []
      ),
    enabled: !!materialId,
    staleTime: Infinity,
    retry: false,
  });
}

/** The reading list (M9), public. */
export function useGroupBooks(slug: string) {
  return useQuery({ queryKey: groupKeys.books(slug), queryFn: () => api.getGroupBooks(slug) });
}

/** Comrades who share a group with you, signed in only. */
export function useGroupComrades() {
  const { hasHydrated, readerId } = useViewer();
  return useQuery({
    queryKey: [...groupKeys.all, "@comrades", readerId] as const,
    queryFn: api.getGroupComrades,
    enabled: hasHydrated && !!readerId,
    staleTime: 5 * 60_000,
  });
}

/** Every group write refetches everything about groups, before the
 * caller's own callbacks run (so "Read this now" opens M7 on the new book),
 * and the feeds in the background: a join or leave changes which Whole
 * circle notes you can read. */
function useGroupMutation<T>(request: (input: T) => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: communityKeys.feedPrefix });
      void queryClient.invalidateQueries({ queryKey: homeKey });
      return queryClient.invalidateQueries({ queryKey: groupKeys.all });
    },
  });
}

/** Start a group (POST /groups): Home's groups refetch, then you're in it. */
export function useCreateGroup() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: api.createGroup,
    onSuccess: ({ slug }) => {
      void queryClient.invalidateQueries({ queryKey: homeKey });
      void queryClient.invalidateQueries({ queryKey: groupKeys.all });
      router.push(groupHref(slug));
    },
  });
}

export const useJoinGroup = (slug: string) => useGroupMutation<void>(() => api.joinGroup(slug));

/** Join from anywhere (spec §6.1): signed in, joins at once; signed out,
 * remembers the group and goes to signup, and the group page finishes the
 * join after auth. */
export function useJoinAction(slug: string) {
  const router = useRouter();
  const isAuthenticated = useIsAuthenticated();
  const join = useJoinGroup(slug);
  const start = () => {
    if (isAuthenticated) return join.mutate();
    setPendingJoin(slug);
    router.push("/auth/signup");
  };
  return { join: start, isPending: join.isPending };
}

/** A moderator's tagged invite (POST /groups/{slug}/invite). Changes no
 * group data, so nothing to refetch. */
export const useInviteToGroup = (slug: string) =>
  useMutation({ mutationFn: (readerIds: string[]) => api.inviteToGroup(slug, readerIds) });

export const useLeaveGroup = (slug: string) => useGroupMutation<void>(() => api.leaveGroup(slug));

/** Mute, shown flipped at once and put back if the write fails. */
export function useMuteGroup(slug: string) {
  const queryClient = useQueryClient();
  const readerId = useSessionStore((s) => s.readerId);
  const set = (muted: boolean) => queryClient.setQueryData<GroupPage>(groupKeys.page(slug, readerId), (page) => page && { ...page, muted });
  return useMutation({
    mutationFn: (muted: boolean) => api.setMuted(slug, muted),
    onMutate: set,
    onError: (_err, muted) => set(!muted),
  });
}

export const useSetMemberRole = (slug: string) =>
  useGroupMutation(({ readerId, role }: { readerId: string; role: GroupRole }) => api.setMemberRole(slug, readerId, role));

export const useRemoveMember = (slug: string) => useGroupMutation((readerId: string) => api.removeMember(slug, readerId));

/** A rename moves the group to a new slug; Manage follows it there. */
export function useUpdateGroup(slug: string) {
  const router = useRouter();
  return useGroupMutation(async (update: { name?: string; description?: string }) => {
    const saved = await api.updateGroup(slug, update);
    if (saved.slug !== slug) router.replace(`${groupHref(saved.slug)}/manage`);
  });
}

/** Deletes the group and goes home. Group and feed caches are only marked
 * stale, so the page being left doesn't refetch itself into "not found". */
export function useDeleteGroup(slug: string) {
  const router = useRouter();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.deleteGroup(slug),
    onSuccess: () => {
      router.replace("/home");
      void queryClient.invalidateQueries({ queryKey: groupKeys.all, refetchType: "none" });
      void queryClient.invalidateQueries({ queryKey: communityKeys.feedPrefix, refetchType: "none" });
    },
  });
}

export const useAddGroupBook = (slug: string) => useGroupMutation((materialId: string) => api.addGroupBook(slug, materialId));

export const useUpdateGroupBook = (slug: string) =>
  useGroupMutation(({ materialId, update }: { materialId: string; update: api.GroupBookUpdate }) =>
    api.updateGroupBook(slug, materialId, update)
  );

/** Rearrange Up next: the list takes the new order at once, so a move
 * doesn't snap back while the save is in flight. */
export function useReorderGroupBooks(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (order: string[]) => api.reorderGroupBooks(slug, order),
    onMutate: async (order) => {
      await queryClient.cancelQueries({ queryKey: groupKeys.books(slug) });
      queryClient.setQueryData<GroupBook[]>(groupKeys.books(slug), (books) => {
        if (!books) return books;
        const rank = new Map(order.map((id, i) => [id, i]));
        const moved = books.filter((b) => rank.has(b.material.id)).sort((a, b) => rank.get(a.material.id)! - rank.get(b.material.id)!);
        let i = 0;
        return books.map((b) => (rank.has(b.material.id) ? moved[i++] : b));
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: groupKeys.books(slug) }),
  });
}

export const useRemoveGroupBook = (slug: string) => useGroupMutation((materialId: string) => api.removeGroupBook(slug, materialId));

/** Pin to top, or unpin with null (one per group). */
export const usePinPost = (slug: string) => useGroupMutation((postId: string | null) => api.pinPost(slug, postId));

export const useSetTarget = (slug: string) => useGroupMutation((input: api.TargetInput) => api.setTarget(slug, input));

export const useClearTarget = (slug: string) => useGroupMutation<void>(() => api.clearTarget(slug));

export const useCreateSession = (slug: string) => useGroupMutation((input: api.SessionInput) => api.createSession(slug, input));

export const useUpdateSession = (slug: string) =>
  useGroupMutation(({ id, input }: { id: string; input: api.SessionInput }) => api.updateSession(slug, id, input));

export const useCancelSession = (slug: string) =>
  useGroupMutation(({ id, scope }: { id: string; scope: "occurrence" | "series" }) => api.cancelSession(slug, id, scope));

/** Remind me, shown flipped at once and put back if the write fails. */
export function useSessionReminder(slug: string) {
  const queryClient = useQueryClient();
  const readerId = useSessionStore((s) => s.readerId);
  const key = groupKeys.sessions(slug, readerId);
  const flip = (seriesOrSessionId: string, on: boolean) =>
    queryClient.setQueryData<SessionsView>(key, (view) =>
      view && { ...view, upcoming: view.upcoming.map((s) => (reminderKey(s) === seriesOrSessionId ? { ...s, remind: on } : s)) }
    );
  return useMutation({
    mutationFn: ({ session, on }: { session: GroupSession; on: boolean }) => api.setSessionReminder(slug, session.id, on),
    onMutate: ({ session, on }) => flip(reminderKey(session), on),
    onError: (_err, { session, on }) => flip(reminderKey(session), !on),
  });
}
