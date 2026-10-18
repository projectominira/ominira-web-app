"use client";

import { useState } from "react";
import SearchableAppPage from "@/app/components/shell/SearchableAppPage";
import StartGroupSheet from "@/app/components/groups/StartGroupSheet";
import Home from "@/app/components/rooms/Home";
import StartRoomSheet from "@/app/components/rooms/StartRoomSheet";
import { useShell } from "@/app/components/useShell";
import { useIsAuthenticated } from "@/lib/auth/useIsAuthenticated";
import { useEnterRoom, type RoomEntry } from "@/lib/room/useEnterRoom";
import { useOpenRoom } from "@/lib/room/useOpenRoom";
import { useHome, useSaveGoal } from "@/lib/rooms/useHome";
import { activeRoom, useRoomStore } from "@/stores/room-store";
import HomeInstallBanner from "./HomeInstallBanner";
import HomePushPrompt from "./HomePushPrompt";

/**
 * Home (home-spec §2 Home): the hub, from one summary call, signed in or
 * out — the reading rooms, Featured books, Today (the book you're reading
 * and your streak), study groups and book rooms. A room joined or started
 * from the strip opens in its book; a group started here opens on its page.
 */
export default function HomeScreen() {
  const { data: view, isError } = useHome();
  const saveGoal = useSaveGoal();
  const desktop = useShell();
  const { enter, pending } = useEnterRoom();
  const openRoom = useOpenRoom();
  const signedIn = useIsAuthenticated();
  const [starting, setStarting] = useState(false);
  const [startingGroup, setStartingGroup] = useState(false);
  const myRoom = useRoomStore((s) => activeRoom(s)?.room ?? null);

  const go = async (entry: RoomEntry) => {
    if (await enter(entry)) openRoom(entry.materialId);
  };

  return (
    <SearchableAppPage>
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
        onStartRoom={signedIn ? () => setStarting(true) : undefined}
        onStartGroup={signedIn ? () => setStartingGroup(true) : undefined}
        myRoom={myRoom}
        onOpenRoom={myRoom ? () => openRoom(myRoom.materialId) : undefined}
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
