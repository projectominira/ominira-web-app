import { create } from "zustand";

/** The feed panel's tabs. "group" is the notes tab narrowed to comrades
 * who share a group with you, offered once you're in one. */
export type FeedTab = "notes" | "highlights" | "group";

/**
 * Which book's feed panel is open, and on which tab. In a store rather than
 * the reader's own state so the room's mini-player, in the app shell, can
 * fold to its pill while it's open. Per book, so another book's reader never opens with it. `pageFor` is
 * the book whose details page is showing, so opening the room there stays
 * on the page (useOpenRoom).
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
