import { errorMessage } from "@/lib/api/client";
import { showToast } from "@/stores/toast-store";

/** A group write's onError: the server's message, or `fallback`. */
export const onFail = (fallback: string) => (err: unknown) => showToast(errorMessage(err) ?? fallback);
