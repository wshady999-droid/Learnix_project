-- =============================================================================
-- Learnix — Migration 19: Course Thumbnails Bucket & Teacher Upload RLS Policy
-- Ensures the public `course-thumbnails` bucket exists (5 MB max, JPEG/PNG/WEBP)
-- and allows authenticated teachers (both before and after course row creation)
-- and admins to upload/update course cover images, while public/students can read.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-thumbnails',
  'course-thumbnails',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "storage_course_thumbnails_read" on storage.objects;
create policy "storage_course_thumbnails_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'course-thumbnails');

drop policy if exists "storage_course_thumbnails_write_teacher_or_admin" on storage.objects;
create policy "storage_course_thumbnails_write_teacher_or_admin" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'course-thumbnails'
    and (
      (select private.is_admin())
      or (
        (select private.is_teacher())
        and (
          -- Allow teacher uploading under their own user_id folder or under a course_id they own
          (storage.foldername(name))[1] = (select auth.uid())::text
          or (
            (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            and (select private.is_course_teacher(((storage.foldername(name))[1])::uuid))
          )
        )
      )
    )
  )
  with check (
    bucket_id = 'course-thumbnails'
    and (
      (select private.is_admin())
      or (
        (select private.is_teacher())
        and (
          (storage.foldername(name))[1] = (select auth.uid())::text
          or (
            (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            and (select private.is_course_teacher(((storage.foldername(name))[1])::uuid))
          )
        )
      )
    )
  );
