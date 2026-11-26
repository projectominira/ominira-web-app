import { ANNOUNCEMENT_FROM, renderAnnouncement, type EmailBook } from "@/lib/email/announcement";
import type { OutgoingEmail } from "@/lib/email/resend";
import { unsubscribeUrls } from "@/lib/email/unsubscribe";

type Message = { title: string; body: string; url: string };

/** One email to one reader, with their own unsubscribe link (never a shared
 * To/BCC); `books` when it links to a reading list. Used by broadcasts
 * (lib/broadcast/queue.ts) and lib/notifications' email channel. */
export function announcementEmail(reader: { id: string; email: string }, message: Message, books: EmailBook[] = []): OutgoingEmail {
  const unsubscribe = unsubscribeUrls(reader.id);
  return {
    from: ANNOUNCEMENT_FROM,
    to: [reader.email],
    subject: message.title,
    ...renderAnnouncement({ ...message, books, unsubscribeUrl: unsubscribe.page }),
    headers: {
      "List-Unsubscribe": `<${unsubscribe.oneClick}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}
