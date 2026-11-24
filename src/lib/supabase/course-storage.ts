"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export const COURSE_THUMBNAIL_BUCKET = "course-thumbnails";
export const MAX_COURSE_THUMBNAIL_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_COURSE_THUMBNAIL_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export function validateCourseThumbnailFile(file: File): string | null {
  if (
    !(ALLOWED_COURSE_THUMBNAIL_TYPES as readonly string[]).includes(file.type)
  ) {
    return "Only JPG, PNG, or WEBP images are allowed for the course cover.";
  }

  if (file.size <= 0) {
    return "Selected image file is empty.";
  }

  if (file.size > MAX_COURSE_THUMBNAIL_BYTES) {
    return "Course cover image must be 5 MB or smaller.";
  }

  return null;
}

/**
 * Uploads a course cover image to the public `course-thumbnails` Supabase Storage bucket
 * and returns its public URL so it can be persisted in `courses.thumbnail_url`.
 *
 * Storage path format: `<courseId or teacherId>/<timestamp>_<sanitizedFileName>`
 */
export async function uploadCourseThumbnail(params: {
  file: File;
  folderId: string;
}): Promise<{ publicUrl: string; storagePath: string }> {
  const validationError = validateCourseThumbnailFile(params.file);
  if (validationError) {
    throw new Error(validationError);
  }

  const supabase = createSupabaseBrowserClient();
  const safeFileName = params.file.name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.{2,}/g, "_");
  const folder = params.folderId.trim() || "courses";
  const storagePath = `${folder}/${Date.now()}_${safeFileName}`;

  const { error: uploadError } = await supabase.storage
    .from(COURSE_THUMBNAIL_BUCKET)
    .upload(storagePath, params.file, {
      upsert: true,
      contentType: params.file.type,
      cacheControl: "3600",
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data } = supabase.storage
    .from(COURSE_THUMBNAIL_BUCKET)
    .getPublicUrl(storagePath);

  if (!data?.publicUrl) {
    throw new Error("Unable to retrieve public URL for uploaded course thumbnail.");
  }

  return {
    publicUrl: data.publicUrl,
    storagePath,
  };
}
