import { create } from "zustand";

/** The feed panel's tabs. "room" is the live room, offered only while
 * you're in the room on this book. "group" is the notes tab narrowed to
 * comrades who share a group with you, offered once you're in one. */
export type FeedTab = "room" | "notes" | "highlights" | "group";

/**
 * Which book's feed panel is open, and on which tab. In a store rather than
 * the reader's own state because the room's mini-player lives in the app
 * shell: expanding it opens this panel on the Room tab. Per book, so another
 * book's reader never opens with it. `pageFor` is the book whose details
 * page is showing: it hosts the live room on its own Live tab (`openFor` on
 * "room"), so expanding the player there stays on the page.
 */
type FeedState = {
  openFor: string | null;
  tab: FeedTab;
  pageFor: string | null;
  setPage: (materialId: string | null) => void;
  open: (materialId: string, tab: FeedTab) => void;
  setTab: (tab: FeedTab) => void;
  close: () => void;
};

export const useFeedStore = create<FeedState>()((set) => ({
  openFor: null,
  tab: "notes",
  pageFor: null,
  setPage: (pageFor) => set({ pageFor }),
  open: (openFor, tab) => set({ openFor, tab }),
  setTab: (tab) => set({ tab }),
  close: () => set({ openFor: null }),
}));
