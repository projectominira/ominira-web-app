"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Info, LogOut, Mic, Settings, Trash2 } from "lucide-react";
import GroupRoom from "@/app/components/rooms/GroupRoom";
import type { RoomOverlay } from "@/app/components/rooms/RoomPanel";
import RoomInput from "@/app/components/rooms/RoomInput";
import RoomScreen from "@/app/components/rooms/RoomScreen";
import StatusPage from "@/app/components/shared/StatusPage";
import { errorMessage } from "@/lib/api/client";
import { useIsAuthenticated } from "@/lib/auth/useIsAuthenticated";
import { quoteReaderHref } from "@/app/components/rooms/PassageQuote";
import { comradeCount, groupHref, sessionWhen } from "@/lib/groups/copy";
import {
  useChapterEnds,
  useDeleteGroup,
  useGroup,
  useGroupBooks,
  useGroupSessions,
  useGroupTarget,
  useJoinAction,
  useJoinGroup,
  useLeaveGroup,
  useSessionReminder,
} from "@/lib/groups/hooks";
import { clearPendingJoin, pendingJoin } from "@/lib/groups/pendingJoin";
import { groupKeys } from "@/lib/groups/queryKeys";
import { dueSession, sessionDays } from "@/lib/groups/sessions";
import type { GroupSession } from "@/lib/groups/types";
import { useGroupRoom } from "@/lib/groups/useGroupRoom";
import { toRoomSession, toRoomTarget } from "@/lib/rooms/cards";
import { useGroupStream, useRoomDelete, useRoomHeart, useRoomReply, useRoomSend } from "@/lib/rooms/hooks";
import { roomItems } from "@/lib/rooms/timeline";
import type { RoomItem, RoomNote } from "@/lib/rooms/types";
import { useMarkRoomRead } from "@/lib/rooms/useMarkRoomRead";
import { useNow } from "@/lib/time/useNow";
import { deviceTimeZone, localDay } from "@/lib/time/zone";
import { confirmAction } from "@/stores/confirm-store";
import { useSessionStore } from "@/stores/session-store";
import { showToast } from "@/stores/toast-store";
import GroupInfoPanel from "./GroupInfoPanel";
import SessionSheet from "./SessionSheet";
import { TargetPanel } from "./TargetSheet";
import { onFail } from "./onFail";

/** A signed-out Join finishes here once the reader is back signed in
 * (lib/groups/pendingJoin.ts). */
function useFinishPendingJoin(slug: string, joined: boolean | undefined) {
  const isAuthenticated = useIsAuthenticated();
  const join = useJoinGroup(slug);
  const { mutate } = join;
  useEffect(() => {
    if (!isAuthenticated || joined === undefined || pendingJoin() !== slug) return;
    clearPendingJoin();
    if (!joined) mutate();
  }, [isAuthenticated, joined, slug, mutate]);
}

/**
 * The study group's page (rooms-spec §2, 4a / 4b): the room, with Group info
 * a side panel (a full panel on mobile); a screen of its own on both. Everyone sees
 * the same room; only moderators get the cards' Start and Edit, and someone
 * outside the group gets Join where the input goes.
 */
export default function GroupView({ slug, initialAbout }: { slug: string; initialAbout: boolean }) {
  const router = useRouter();
  const [aboutOpen, setAboutOpen] = useState(initialAbout);
  // A quote opens the reader over the room (the `@modal` overlay).
  const openPassage = (n: RoomNote) => {
    const href = quoteReaderHref(n);
    if (href) router.push(href);
  };
  const viewerId = useSessionStore((s) => s.readerId);
  const { data, isLoading, isError } = useGroup(slug);
  useFinishPendingJoin(slug, data ? data.myRole !== null : undefined);
  const { data: target } = useGroupTarget(slug);
  const { data: books } = useGroupBooks(slug);
  const { data: sessions } = useGroupSessions(slug);
  const stream = useGroupStream(slug);
  const current = books?.find((b) => b.status === "current")?.material;
  // A chapter target's labels ("Ch. 4–6", "You · Ch. 5"); a percentage
  // target speaks in percent, and a PDF has no chapters to ask for.
  const { data: ends = [] } = useChapterEnds(target?.target?.endChapter != null ? target.currentMaterialId : null);
  const streamKey = groupKeys.stream(slug, viewerId);
  const send = useRoomSend(streamKey, { groupSlug: slug });
  const heart = useRoomHeart(streamKey);
  const reply = useRoomReply(streamKey);
  const del = useRoomDelete(streamKey);
  // What the room has open on demand: the team's ＋ menu and target sheet (5a / 5b).
  const [open, setOpen] = useState<"target" | null>(null);
  const markRead = useMarkRoomRead("group", viewerId ? (data?.group.id ?? null) : null);
  const reminder = useSessionReminder(slug);
  const { join, isPending: joining } = useJoinAction(slug);
  const leave = useLeaveGroup(slug);
  const deleteGroup = useDeleteGroup(slug);
  const room = useGroupRoom(slug);
  // M8: a new session, or editing one.
  const [sessionSheet, setSessionSheet] = useState<{ session?: GroupSession } | null>(null);

  const tz = deviceTimeZone();
  const roomTarget = useMemo(() => target && toRoomTarget(target, current?.title ?? "", ends), [target, current?.title, ends]);
  const now = useNow();
  const roomSession = useMemo(() => sessions && toRoomSession(sessions, now), [sessions, now]);
  const items = useMemo((): RoomItem[] => {
    const cards = [
      ...(roomTarget ? [{ ref: roomTarget.view.target!.id, item: { t: "target", target: roomTarget } as RoomItem }] : []),
      ...(roomSession ? [{ ref: roomSession.ref, item: { t: "session", card: roomSession.card } as RoomItem }] : []),
    ];
    const all = roomItems(stream.data?.pages ?? [], { tz, viewerId, cards, pending: send.items });
    return all.length ? all : [{ t: "empty" }];
  }, [stream.data, roomTarget, roomSession, send.items, tz, viewerId]);

  const frame = (body: React.ReactNode) => <RoomScreen sidebar={false}>{body}</RoomScreen>;

  if (isError || (!isLoading && !data)) return frame(<StatusPage title="Group not found" className="min-h-[60vh]" />);

  const group = data?.group;
  const myRole = data?.myRole ?? null;
  const isModerator = myRole === "moderator";
  const upcoming = sessions?.upcoming[0] ?? null;

  // M11: on the current book, for the session that's due (an hour either
  // side of its start), picking up its topic. Every other member gets `room_live`.
  const onStartRoom = async () => {
    if (!group || room.pending) return;
    if (!current) return showToast("Choose the book you're reading now first.");
    const due = sessions ? dueSession(sessions.upcoming, Date.now()) : null;
    const others = group.memberCount - 1;
    const ok = await confirmAction({
      title: due ? due.topic : "Start a room?",
      message: [
        due ? `${sessionWhen(due.startsAt)} · ${current.title}.` : `${current.title}, with no session.`,
        others > 0 ? `${others === 1 ? "Your comrade gets" : `All ${comradeCount(others)} get`} “The room is open”.` : "",
      ]
        .join(" ")
        .trim(),
      confirmLabel: "Start room",
    });
    if (ok) await room.start(current.id, due?.topic ?? null, due?.id ?? null);
  };
  const onLeave = async () => {
    if (!group || !(await confirmAction({ title: `Leave ${group.name}?`, message: "You can join again any time.", confirmLabel: "Leave" }))) return;
    leave.mutate(undefined, { onError: (err) => showToast(errorMessage(err) ?? "Couldn't leave the group.") });
  };
  const onDelete = async () => {
    if (!group) return;
    const ok = await confirmAction({
      title: `Delete ${group.name}?`,
      message: "Its reading list, sessions and targets go for good. Notes posted here stay with their authors.",
      confirmLabel: "Delete group",
      danger: true,
    });
    if (ok) deleteGroup.mutate(undefined, { onError: onFail("Couldn't delete the group.") });
  };
  const onRemind = upcoming?.remind != null ? () => reminder.mutate({ session: upcoming, on: !upcoming.remind }) : undefined;
  const close = () => setOpen(null);
  const team: RoomOverlay | null =
    aboutOpen
      ? null
      : open === "target" && group && target
        ? {
            onClose: close,
            render: (layout) => (
              <TargetPanel layout={layout} slug={slug} view={target} bookTitle={current?.title ?? ""} groupName={group.name} className={layout === "panel" ? "h-full" : undefined} onClose={close} />
            ),
          }
        : null;

  // Invite is the head's Share.
  const menu = isModerator
    ? [
        { label: "Start a room", icon: <Mic size={13} />, onClick: () => void onStartRoom() },
        { label: "Manage", icon: <Settings size={13} />, onClick: () => router.push(`${groupHref(slug)}/manage`) },
        { label: "Delete group", icon: <Trash2 size={13} />, danger: true, onClick: () => void onDelete() },
      ]
    : myRole
      ? [{ label: "Leave group", icon: <LogOut size={13} />, onClick: () => void onLeave() }]
      : [];

  menu.unshift({ label: "Group info", icon: <Info size={13} />, onClick: () => setAboutOpen(true) });

  return frame(
    <>
      <GroupRoom
        name={group?.name ?? ""}
        memberCount={group?.memberCount ?? 0}
        aboutOpen={aboutOpen}
        onAbout={() => {
          setOpen(null);
          setAboutOpen(true);
        }}
        onCloseAbout={() => setAboutOpen(false)}
        about={
          data && (
            <GroupInfoPanel
              slug={slug}
              page={data}
              target={target}
              sessions={sessions}
              roomTarget={roomTarget ?? null}
              roomSession={roomSession?.card ?? null}
              viewerId={viewerId}
              onRemind={onRemind}
              onSetTarget={() => {
                setAboutOpen(false);
                setOpen("target");
              }}
              onSchedule={() => setSessionSheet({})}
              onStartRoom={() => void onStartRoom()}
            />
          )
        }
        items={items}
        viewerId={viewerId}
        today={localDay(now, tz)}
        team={isModerator}
        loading={isLoading || stream.isLoading}
        states={send.states}
        hasOlder={stream.hasNextPage}
        onLoadOlder={() => !stream.isFetchingNextPage && void stream.fetchNextPage()}
        onReadToBottom={markRead}
        target={roomTarget ?? null}
        session={roomSession?.card ?? null}
        menu={menu}
        onBack={() => (window.history.length > 1 ? router.back() : router.push("/home"))}
        onJoinLive={sessions?.live && myRole ? () => void room.join(sessions.live!) : undefined}
        overlay={team}
        handlers={{
          onReact: (n, replyId) => viewerId && heart.mutate({ noteId: replyId ?? n.note.id, rootId: n.note.id }),
          onReply: viewerId ? (n, r, to) => void reply(n.note.id, r, to, n.note.ranges) : undefined,
          onDelete: viewerId ? (n, replyId) => del.mutate({ noteId: replyId ?? n.note.id, rootId: n.note.id }) : undefined,
          onRetry: (n) => send.retry(n.note.id),
          onPassage: openPassage,
          onContinue: current ? () => router.push(`/reader/${current.slug}`) : undefined,
          onRemind,
          onStart: () => void onStartRoom(),
          onEditTarget: () => setOpen("target"),
          onEditSession: () => upcoming && setSessionSheet({ session: upcoming }),
        }}
        input={
          myRole ? (
            <RoomInput placeholder="Message the group" groupSlug={slug} onSend={send.send} />
          ) : (
            <button type="button" onClick={join} disabled={joining || isLoading} className="mx-auto flex min-h-12 cursor-pointer items-center justify-center px-4 text-ui-sm font-extrabold text-[var(--color-app-brand)] hover:text-brand-600 disabled:opacity-60">
              Join the group
            </button>
          )
        }
      />
      {sessionSheet && (
        <SessionSheet slug={slug} session={sessionSheet.session} marks={sessionDays(sessions?.upcoming ?? [], tz)} onClose={() => setSessionSheet(null)} />
      )}
    </>
  );
}
