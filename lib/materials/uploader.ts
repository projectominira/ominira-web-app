import { cookies } from "next/headers";
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/admin/pin";
import { forbidden, unauthorized } from "@/lib/api/errors";
import { getAuthenticatedReader, isAdminReader } from "@/lib/auth/session";
import { readerCanUpload } from "@/lib/auth/profile";

/** Who an upload is from: a signed-in reader, or the admin on the PIN alone
 * (/admin/library/new), whose books have no uploader. `folder` is the
 * uploads/<folder>/ the upload's objects go in. */
export type Uploader = { readerId: string | null; folder: string; admin: boolean };

/** Both upload steps call this first. `asAdmin` (from the request body)
 * asks for an admin upload, which needs a valid admin PIN cookie; otherwise
 * it's the signed-in reader. A Response is the refusal to send back. */
export async function getUploader(request: Request, asAdmin: unknown): Promise<Uploader | Response> {
  if (asAdmin === true) {
    if (!(await verifyAdminSession((await cookies()).get(ADMIN_COOKIE)?.value))) return unauthorized();
    return { readerId: null, folder: "admin", admin: true };
  }
  const reader = await getAuthenticatedReader(request);
  if (!reader) return unauthorized();
  if (!(await readerCanUpload(reader))) return forbidden("Uploading books is open to approved readers only.");
  return { readerId: reader.readerId, folder: reader.readerId, admin: isAdminReader(reader) };
}
