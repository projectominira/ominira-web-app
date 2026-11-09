"use client";

import { useState } from "react";
import { ApiError, apiFetch } from "@/lib/api/client";
import type { BookRequest } from "@/lib/materials/suggestions";

/** Sends one book request (POST /api/materials/suggestions) and tracks its state. */
export function useBookRequest() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function send(text: string): Promise<BookRequest | null> {
    if (!text.trim() || state === "sending") return null;
    setState("sending");
    setError(null);
    try {
      const { item } = await apiFetch<{ item: BookRequest }>("/materials/suggestions", { json: { text } });
      setState("sent");
      return item;
    } catch (err) {
      setState("error");
      setError(err instanceof ApiError ? err.message : "That didn't go through. Please try again.");
      return null;
    }
  }

  return { send, state, error, reset: () => (setState("idle"), setError(null)) };
}
