"use client";

import { useState, type ReactNode } from "react";
import SearchModal from "@/app/components/SearchModal";
import AppHeader from "./AppHeader";

type Props = {
  children: ReactNode;
  className?: string;
  /** Home's greeting, in place of the page's own heading (AppHeader). */
  greeting?: string;
  /** The reader's name after the greeting. */
  greetingName?: string;
};

/**
 * Standard reader-facing page frame: the global book search comes before
 * each page's heading and content, and always opens the same result modal.
 */
export default function SearchableAppPage({ children, className = "pb-10", greeting, greetingName }: Props) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className={className}>
      <AppHeader onSearchFocus={() => setSearchOpen(true)} greeting={greeting} greetingName={greetingName} />

      {searchOpen && (
        <div className="fixed inset-0 z-50">
          <SearchModal onClose={() => setSearchOpen(false)} />
        </div>
      )}

      {children}
    </div>
  );
}
