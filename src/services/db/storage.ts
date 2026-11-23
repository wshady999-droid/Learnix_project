import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ServiceResult } from "@/types";

export const STORAGE_BUCKETS = {
  profilePictures: {
    id: "profile-pictures",
    isPublic: true,
    maxBytes: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"] as const,
  },
  courseThumbnails: {
    id: "course-thumbnails",
    isPublic: true,
    maxBytes: 10 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"] as const,
  },
  courseVideos: {
    id: "course-videos",
    isPublic: false,
    maxBytes: 500 * 1024 * 1024,
    allowedMimeTypes: ["video/mp4", "video/webm", "video/quicktime"] as const,
  },
  courseMaterials: {
    id: "course-materials",
    isPublic: false,
    maxBytes: 50 * 1024 * 1024,
    allowedMimeTypes: [
      "application/pdf",
      "application/zip",
      "text/plain",
      "text/markdown",
      "image/png",
      "image/jpeg",
      "image/webp",
    ] as const,
  },
  coursePdfs: {
    id: "course-pdfs",
    isPublic: false,
    maxBytes: 50 * 1024 * 1024,
    allowedMimeTypes: ["application/pdf"] as const,
  },
  coursePresentations: {
    id: "course-presentations",
    isPublic: false,
    maxBytes: 100 * 1024 * 1024,
    allowedMimeTypes: [
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/pdf",
    ] as const,
  },
  assignmentAttachments: {
    id: "assignment-attachments",
    isPublic: false,
    maxBytes: 25 * 1024 * 1024,
    allowedMimeTypes: [
      "application/pdf",
      "application/zip",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "image/png",
      "image/jpeg",
    ] as const,
  },
  messageAttachments: {
    id: "message-attachments",
    isPublic: false,
    maxBytes: 25 * 1024 * 1024,
    allowedMimeTypes: [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/webp",
      "text/plain",
      "application/zip",
    ] as const,
  },
  certificates: {
    id: "certificates",
    isPublic: false,
    maxBytes: 15 * 1024 * 1024,
    allowedMimeTypes: ["application/pdf", "image/png"] as const,
  },
} as const;

export type StorageBucketKey = keyof typeof STORAGE_BUCKETS;
export type StorageBucketId = (typeof STORAGE_BUCKETS)[StorageBucketKey]["id"];

export interface UploadFileMetadata {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Validates file size, MIME type, and safe path segments before any upload reaches Supabase Storage.
 */
export function validateStorageUpload(
  bucketKey: StorageBucketKey,
  file: UploadFileMetadata,
): ServiceResult<{ sanitizedFileName: string; bucketId: StorageBucketId }> {
  const bucket = STORAGE_BUCKETS[bucketKey];

  if (file.sizeBytes <= 0) {
    return { ok: false, error: "Uploaded file is empty." };
  }

  if (file.sizeBytes > bucket.maxBytes) {
    const maxMb = Math.round(bucket.maxBytes / (1024 * 1024));
    return {
      ok: false,
      error: `File size exceeds maximum limit of ${maxMb} MB for bucket '${bucket.id}'.`,
    };
  }

  const allowedList: readonly string[] = bucket.allowedMimeTypes;
  if (!allowedList.includes(file.mimeType)) {
    return {
      ok: false,
      error: `Unsupported file type '${file.mimeType}' for bucket '${bucket.id}'.`,
    };
  }

  const sanitizedFileName = file.fileName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.{2,}/g, "_");

  if (!sanitizedFileName) {
    return { ok: false, error: "Invalid file name." };
  }

  return {
    ok: true,
    data: {
      sanitizedFileName,
      bucketId: bucket.id,
    },
  };
}

export async function createSignedDownloadUrl(params: {
  bucketKey: StorageBucketKey;
  storagePath: string;
  expiresInSeconds?: number;
}): Promise<ServiceResult<string>> {
  const bucket = STORAGE_BUCKETS[params.bucketKey];
  const supabase = await createSupabaseServerClient();

  if (bucket.isPublic) {
    const { data } = supabase.storage.from(bucket.id).getPublicUrl(params.storagePath);
    return { ok: true, data: data.publicUrl };
  }

  const { data, error } = await supabase.storage
    .from(bucket.id)
    .createSignedUrl(params.storagePath, params.expiresInSeconds ?? 3600);

  if (error || !data?.signedUrl) {
    return { ok: false, error: error?.message ?? "Failed to generate signed download URL." };
  }

  return { ok: true, data: data.signedUrl };
}
