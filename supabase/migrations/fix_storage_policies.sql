-- =============================================================================
-- Fix Supabase Storage RLS Policies for `course-thumbnails`
-- Copy and paste this entire script into the Supabase Dashboard -> SQL Editor.
-- =============================================================================

-- 1. Ensure the `course-thumbnails` bucket exists and is set to public
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

-- 2. Drop any previous restrictive policies on `course-thumbnails`
drop policy if exists "storage_course_thumbnails_read" on storage.objects;
drop policy if exists "storage_course_thumbnails_write_teacher_or_admin" on storage.objects;
drop policy if exists "course_thumbnails_public_select" on storage.objects;
drop policy if exists "course_thumbnails_authenticated_insert" on storage.objects;
drop policy if exists "course_thumbnails_authenticated_update" on storage.objects;
drop policy if exists "course_thumbnails_authenticated_delete" on storage.objects;

-- 3. Allow SELECT for public (anon + authenticated) users on `course-thumbnails`
create policy "course_thumbnails_public_select"
on storage.objects
for select
to public
using (bucket_id = 'course-thumbnails');

-- 4. Allow INSERT for authenticated users on `course-thumbnails`
create policy "course_thumbnails_authenticated_insert"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'course-thumbnails');

-- 5. Allow UPDATE for authenticated users on `course-thumbnails` (required for upsert: true)
create policy "course_thumbnails_authenticated_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'course-thumbnails')
with check (bucket_id = 'course-thumbnails');

-- 6. Allow DELETE for authenticated users on `course-thumbnails`
create policy "course_thumbnails_authenticated_delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'course-thumbnails');
