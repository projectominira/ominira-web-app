import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { validationError } from "@/lib/api/errors";
import { getUploader } from "@/lib/materials/uploader";
import { cdnUrl, presignPut } from "@/lib/storage/r2";
import { ADMIN_UPLOAD_LIMITS, MEMBER_UPLOAD_LIMITS, formatBytes } from "@/lib/materials/uploadLimits";
import { MAX_UPLOAD_IMAGES, isUploadImageName, isUploadMaterialType, thumbnailExtension, uploadObjectPaths } from "@/lib/materials/uploadPaths";

type Body = { asAdmin?: unknown; materialType?: unknown; fileSize?: unknown; thumbnailType?: unknown; imageNames?: unknown };

/**
 * Step 1 of an upload: hands the browser signed URLs to PUT the file (and,
 * for an EPUB, its parsed JSON; for a PDF/EPUB, its cover) straight into
 * R2, plus one per EPUB body image (under the upload's own images
 * folder; `publicUrls` lets the client point the JSON's image `src`s at
 * them before uploading it). Bytes never pass through this app's own functions — a serverless
 * request body is capped at a few MB, far below a 200 MB admin upload.
 * Step 2 is POST /api/materials/upload, which checks what actually landed.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Body;
  const uploader = await getUploader(request, body.asAdmin);
  if (uploader instanceof Response) return uploader;
  if (!isUploadMaterialType(body.materialType)) return validationError("materialType must be 'book', 'pdf', or 'docx'.", "materialType");
  if (typeof body.fileSize !== "number" || body.fileSize <= 0) return validationError("fileSize is required.", "fileSize");

  const limits = uploader.admin ? ADMIN_UPLOAD_LIMITS : MEMBER_UPLOAD_LIMITS;
  if (body.fileSize > limits.maxFileSizeBytes) {
    return validationError(`Files must be under ${formatBytes(limits.maxFileSizeBytes)}.`, "fileSize");
  }

  const imageNames = body.materialType === "book" && Array.isArray(body.imageNames) ? body.imageNames : [];
  if (imageNames.length > MAX_UPLOAD_IMAGES) return validationError("This book has too many images.", "imageNames");
  if (!imageNames.every(isUploadImageName) || new Set(imageNames).size !== imageNames.length) {
    return validationError("Invalid image names.", "imageNames");
  }

  const uploadId = randomUUID();
  const paths = uploadObjectPaths(uploader.folder, uploadId, body.materialType, thumbnailExtension(body.thumbnailType));

  try {
    // Signing is local (no network), so even 500 images sign at once. The
    // source's signature covers its declared size.
    const sign = (path: string | null, size?: number) => (path ? presignPut(path, size) : Promise.resolve(null));
    const [source, json, thumbnail, ...imageUrls] = await Promise.all([
      sign(paths.source, body.fileSize),
      sign(paths.json),
      sign(paths.thumbnail),
      ...imageNames.map((name) => sign(`${paths.images}/${name}`)),
    ]);
    const images = Object.fromEntries(imageNames.map((name, i) => [name, imageUrls[i]]));
    const publicUrls = {
      thumbnail: paths.thumbnail ? cdnUrl(paths.thumbnail) : null,
      images: Object.fromEntries(imageNames.map((name) => [name, cdnUrl(`${paths.images}/${name}`)])),
    };
    return NextResponse.json({ uploadId, urls: { source, json, thumbnail, images }, publicUrls });
  } catch {
    return validationError("Could not prepare this upload. Please try again.");
  }
}
