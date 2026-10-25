"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Loader from "@/app/components/Loader";
import RoomScreen from "@/app/components/rooms/RoomScreen";
import DetailHeader from "@/app/components/shared/DetailHeader";
import StatusPage from "@/app/components/shared/StatusPage";
import UnderlineTabs from "@/app/components/UnderlineTabs";
import TextField from "@/app/components/auth/TextField";
import TextAreaField from "@/app/components/auth/TextAreaField";
import AuthButton from "@/app/components/auth/AuthButton";
import { errorMessage } from "@/lib/api/client";
import { comradeCount, groupHref } from "@/lib/groups/copy";
import { useGroup, useGroupBooks, useGroupMembers, useGroupSessions, useUpdateGroup } from "@/lib/groups/hooks";
import { sessionDays } from "@/lib/groups/sessions";
import { deviceTimeZone } from "@/lib/time/zone";
import { useSessionStore } from "@/stores/session-store";
import { GROUP_DESCRIPTION_MAX, GROUP_NAME_MAX, type GroupInfo, type GroupSession } from "@/lib/groups/types";
import GroupMembers from "./GroupMembers";
import GroupReadingList from "./GroupReadingList";
import SessionList from "./GroupSchedule";
import SessionSheet from "./SessionSheet";

type Tab = "details" | "reading-list" | "sessions" | "members";
const TABS: { value: Tab; label: string }[] = [
  { value: "reading-list", label: "Reading list" },
  { value: "details", label: "Details" },
  { value: "sessions", label: "Sessions" },
  { value: "members", label: "Members" },
];

/** Name and description, editable in place and saved together — Account
 * settings' ProfileForm, down to the Cancel / Save changes footer. */
function DetailsForm({ group }: { group: GroupInfo }) {
  const update = useUpdateGroup(group.slug);
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description);

  const dirty = name.trim() !== group.name || description.trim() !== group.description;
  const nameError = name.trim().length === 0 ? "Give the group a name." : undefined;
  const canSave = dirty && !nameError && !update.isPending;

  const syncTo = (saved: GroupInfo) => {
    setName(saved.name);
    setDescription(saved.description);
  };
  const reset = () => {
    syncTo(group);
    update.reset();
  };

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave)
          update.mutate(
            { name: name.trim(), description: description.trim() },
            { onSuccess: () => syncTo({ ...group, name: name.trim(), description: description.trim() }) },
          );
      }}
    >
      <TextField
        label="Name"
        name="name"
        maxLength={GROUP_NAME_MAX}
        hint={`${name.length}/${GROUP_NAME_MAX}`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={nameError}
      />
      <TextAreaField
        label="Description"
        name="description"
        maxLength={GROUP_DESCRIPTION_MAX}
        hint={`${description.length}/${GROUP_DESCRIPTION_MAX}`}
        rows={4}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      {update.isError && (
        <p className="m-0 text-xs font-medium text-red-500">{errorMessage(update.error) ?? "Couldn’t save. Try again."}</p>
      )}

      <div className="flex items-center justify-end gap-2 pt-4">
        {update.isSuccess && !dirty && (
          <span className="mr-auto text-xs font-semibold text-[var(--color-forest-500)]">Saved</span>
        )}
        {dirty && (
          <button
            type="button"
            onClick={reset}
            className="cursor-pointer rounded-sm border-none bg-transparent px-4 py-2 text-[14px] font-bold text-[var(--reader-text-muted)] hover:text-[var(--reader-text)]"
          >
            Cancel
          </button>
        )}
        <AuthButton type="submit" fullWidth={false} disabled={!canSave}>
          {update.isPending ? "Saving…" : "Save changes"}
        </AuthButton>
      </div>
    </form>
  );
}

/** Manage (M6), laid out exactly like Account settings: back + title row,
 * the group itself with a way through to its page, then underline tabs —
 * Reading list (one list, rearranged and added to here), Details (name and
 * description), Sessions (schedule, edit, cancel) and Members (the M10
 * controls). Opens on Reading list, or the tab `?tab=` names. */
export default function GroupManageView(props: { slug: string; categories: string[]; tab?: string }) {
  // A screen of its own, like the group page: no app sidebar on desktop.
  return (
    <RoomScreen sidebar={false} scroll>
      <div className="px-4 shell:px-0">
        <ManageBody {...props} />
      </div>
    </RoomScreen>
  );
}

function ManageBody({ slug, categories, tab: initialTab }: { slug: string; categories: string[]; tab?: string }) {
  const router = useRouter();
  const viewerId = useSessionStore((s) => s.readerId);
  const { data, isLoading } = useGroup(slug);
  const isModerator = data?.myRole === "moderator";
  const { data: sessions } = useGroupSessions(slug);
  // Every tab's data loads with the page, not once its tab opens.
  useGroupMembers(slug);
  useGroupBooks(slug);
  const [tab, setTab] = useState<Tab>(TABS.find((t) => t.value === initialTab)?.value ?? "reading-list");
  // M8: new (no session) or editing one.
  const [sessionSheet, setSessionSheet] = useState<{ session?: GroupSession } | null>(null);

  // Moderators only; anyone else goes back to the group page.
  useEffect(() => {
    if (data && !isModerator) router.replace(groupHref(slug));
  }, [data, isModerator, router, slug]);

  if (isLoading || (data && !isModerator)) {
    return (
      <div className="relative min-h-[60vh]">
        <Loader confined />
      </div>
    );
  }
  if (!data) return <StatusPage title="Group not found" className="min-h-[60vh]" />;

  const { group } = data;

  return (
    <div className="pb-12">
      <DetailHeader onBack={() => (window.history.length > 1 ? router.back() : router.push(groupHref(slug)))} title="Manage group" />

      <Link href={groupHref(slug)} replace className="group mt-2 mb-6 block min-w-0 no-underline">
        <div className="truncate font-serif text-lg text-[var(--reader-text)]">{group.name}</div>
        <div className="text-xs font-semibold text-[var(--reader-text-muted)] group-hover:text-brand-500">
          {comradeCount(group.memberCount)} · View group
        </div>
      </Link>

      <div className="mb-7">
        <UnderlineTabs options={TABS} value={tab} onChange={setTab} />
      </div>

      {tab === "details" && <DetailsForm key={group.id} group={group} />}

      {tab === "reading-list" && (
        <GroupReadingList slug={slug} categories={categories} />
      )}

      {tab === "sessions" && (
        <SessionList slug={slug} sessions={sessions} onEdit={(s) => setSessionSheet({ session: s })} onSchedule={() => setSessionSheet({})} />
      )}

      {tab === "members" && <GroupMembers slug={slug} viewerId={viewerId} canManage />}

      {sessionSheet && (
        <SessionSheet
          slug={slug}
          session={sessionSheet.session}
          marks={sessionDays(sessions?.upcoming ?? [], deviceTimeZone())}
          onClose={() => setSessionSheet(null)}
        />
      )}
    </div>
  );
}
