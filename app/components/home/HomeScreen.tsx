"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SearchableAppPage from "@/app/components/shell/SearchableAppPage";
import StartGroupSheet from "@/app/components/groups/StartGroupSheet";
import StartRoomSheet from "@/app/components/rooms/StartRoomSheet";
import { useShell } from "@/app/components/useShell";
import { useIsAuthenticated } from "@/lib/auth/useIsAuthenticated";
import { useEnterRoom, type RoomEntry } from "@/lib/room/useEnterRoom";
import { useOpenRoom } from "@/lib/room/useOpenRoom";
import { useHome, useSaveGoal } from "@/lib/rooms/useHome";
import { useSessionStore } from "@/stores/session-store";
import Home from "./Home";
import HomeInstallBanner from "./HomeInstallBanner";
import HomePushPrompt from "./HomePushPrompt";

/**
 * Home (home-spec §2 Home), signed in only, from one summary call. Sign-in
 * is known only on the client, so nothing shows until the session has
 * loaded, and a signed-out visitor goes to the landing page. A room joined
 * or started here opens in the reader; a group started here opens on its
 * page.
 */
export default function HomeScreen() {
  const { data: view, isError } = useHome();
  const saveGoal = useSaveGoal();
  const desktop = useShell();
  const { enter, pending } = useEnterRoom();
  const openRoom = useOpenRoom();
  const signedIn = useIsAuthenticated();
  const hydrated = useSessionStore((s) => s.hasHydrated);
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [startingGroup, setStartingGroup] = useState(false);

  const go = async (entry: RoomEntry) => {
    if (await enter(entry)) openRoom(entry.materialId);
  };

  useEffect(() => {
    if (hydrated && !signedIn) router.replace("/");
  }, [hydrated, signedIn, router]);
  if (!signedIn) return null;

  return (
    <SearchableAppPage className="pb-2 shell:pb-10">
      <HomeInstallBanner />
      <HomePushPrompt />
      <Home
        view={view}
        failed={isError}
        desktop={desktop}
        entering={pending}
        onSaveGoal={(goal) => saveGoal.mutate(goal)}
        onPickRoom={(s) => {
          if (s.room && s.materialId) void go({ materialId: s.materialId, join: s.room });
        }}
        onStartRoom={() => setStarting(true)}
        onStartGroup={() => setStartingGroup(true)}
      />
      {starting && (
        <StartRoomSheet
          onClose={() => setStarting(false)}
          onPick={(b) => {
            setStarting(false);
            void go({ materialId: b.material.id, start: { bookTitle: b.material.title, readers: b.readers } });
          }}
        />
      )}
      {startingGroup && <StartGroupSheet onClose={() => setStartingGroup(false)} />}
    </SearchableAppPage>
  );
}
