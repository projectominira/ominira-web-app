"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { track } from "@/lib/analytics";
import { apiFetch, ApiError } from "@/lib/api/client";
import { useSessionStore, type Session } from "@/stores/session-store";
import { authKeys } from "@/lib/auth/queryKeys";
import type { ReaderProfile } from "@/lib/api/types";

export type SignupInput = {
  fullName: string;
  email: string;
  password: string;
  pseudonym: string;
  city?: string;
  country?: string;
};

/** `POST /api/auth/signup`. Field-level errors (409 email/pseudonym, 400
 * validation) arrive as a thrown ApiError with `.field` set — the signup
 * form reads that straight off `mutation.error` and renders it inline on
 * the matching TextField, per api-spec.md's Conventions. */
export function useSignup() {
  const queryClient = useQueryClient();
  const setSession = useSessionStore((s) => s.setSession);
  return useMutation<{ reader: ReaderProfile; session: Session }, ApiError, SignupInput>({
    mutationFn: (input) => apiFetch<{ reader: ReaderProfile; session: Session }>("/auth/signup", { json: input }),
    onSuccess: ({ reader, session }) => {
      setSession(reader.id, session);
      queryClient.setQueryData(authKeys.me, reader);
      track("signed_up");
    },
  });
}
