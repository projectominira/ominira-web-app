import type { Metadata } from "next";
import StatusPage from "@/app/components/shared/StatusPage";
import RoomInviteScreen from "@/app/components/room/RoomInviteScreen";
import { UUID_RE } from "@/lib/materials/resolve";
import { roomInvite } from "@/lib/room/invite";

type Props = { params: Promise<{ roomId: string }> };

const load = async (roomId: string) => (UUID_RE.test(roomId) ? roomInvite(roomId) : null);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const invite = await load((await params).roomId);
  if (!invite) return { title: "Reading room" };
  return {
    title: invite.title,
    description: `${invite.host ? `${invite.host} is reading` : "Read"} ${invite.bookTitle} together on Ominira. Join the room and listen in.`,
  };
}

/** A room's link (an invite, shared or pushed): the room, then Join. */
export default async function RoomPage({ params }: Props) {
  const invite = await load((await params).roomId);
  if (!invite) return <StatusPage title="No room here">This link doesn’t lead to a reading room.</StatusPage>;
  return <RoomInviteScreen invite={invite} />;
}
