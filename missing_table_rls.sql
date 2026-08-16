-- ==============================================================================
-- NOBLEMINDS — MISSING TABLE RLS POLICIES
-- Covers: schools, academic_years, support_queries,
--         registration_requests, teacher_diaries
--
-- PREREQUISITE: fix_staff_rls_recursion.sql must have been run first
-- (it creates get_my_role() and get_my_school_id() helper functions)
-- ==============================================================================


-- ==============================================================================
-- 1. SCHOOLS
-- Who can do what:
--   SELECT  → any authenticated user (needed for school name lookups in dropdowns)
--   INSERT  → super_admin only
--   UPDATE  → super_admin only
--   DELETE  → super_admin only
-- ==============================================================================

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

-- Drop any old policies first
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'schools' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.schools', pol.policyname);
  END LOOP;
END $$;

-- Any logged-in user can read schools (needed for dropdowns/lookups)
CREATE POLICY "schools_authenticated_read"
  ON schools FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only super_admin can create / modify / delete schools
CREATE POLICY "schools_superadmin_insert"
  ON schools FOR INSERT
  WITH CHECK (get_my_role() = 'super_admin');

CREATE POLICY "schools_superadmin_update"
  ON schools FOR UPDATE
  USING (get_my_role() = 'super_admin');

CREATE POLICY "schools_superadmin_delete"
  ON schools FOR DELETE
  USING (get_my_role() = 'super_admin');


-- ==============================================================================
-- 2. ACADEMIC YEARS
-- Who can do what:
--   SELECT  → users see only their own school's academic years
--   INSERT  → admin or super_admin of that school
--   UPDATE  → admin or super_admin of that school
--   DELETE  → admin or super_admin of that school
-- ==============================================================================

ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'academic_years' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.academic_years', pol.policyname);
  END LOOP;
END $$;

-- Users see academic years for their own school only
CREATE POLICY "academic_years_school_read"
  ON academic_years FOR SELECT
  USING (school_id::text = (get_my_school_id())::text);

-- Admins/super_admins can create academic years for their own school
CREATE POLICY "academic_years_admin_insert"
  ON academic_years FOR INSERT
  WITH CHECK (
    school_id::text = (get_my_school_id())::text
    AND get_my_role() IN ('admin', 'super_admin')
  );

CREATE POLICY "academic_years_admin_update"
  ON academic_years FOR UPDATE
  USING (
    school_id::text = (get_my_school_id())::text
    AND get_my_role() IN ('admin', 'super_admin')
  );

CREATE POLICY "academic_years_admin_delete"
  ON academic_years FOR DELETE
  USING (
    school_id::text = (get_my_school_id())::text
    AND get_my_role() IN ('admin', 'super_admin')
  );


-- ==============================================================================
-- 3. SUPPORT QUERIES
-- Who can do what:
--   SELECT  → super_admin sees all; regular users see nothing via API
--             (support queries are submitted from register/support page which
--              is unauthenticated, and read only by super_admin in admin portal)
--   INSERT  → anyone including unauthenticated (public contact form)
--   UPDATE  → super_admin only (to mark resolved)
--   DELETE  → super_admin only
-- ==============================================================================

ALTER TABLE support_queries ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'support_queries' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.support_queries', pol.policyname);
  END LOOP;
END $$;

-- Super admin reads all support queries
CREATE POLICY "support_queries_superadmin_read"
  ON support_queries FOR SELECT
  USING (get_my_role() = 'super_admin');

-- Public INSERT (unauthenticated form submissions from support/register pages)
CREATE POLICY "support_queries_public_insert"
  ON support_queries FOR INSERT
  WITH CHECK (true);

-- Super admin updates (status: pending → resolved)
CREATE POLICY "support_queries_superadmin_update"
  ON support_queries FOR UPDATE
  USING (get_my_role() = 'super_admin');

-- Super admin deletes
CREATE POLICY "support_queries_superadmin_delete"
  ON support_queries FOR DELETE
  USING (get_my_role() = 'super_admin');


-- ==============================================================================
-- 4. REGISTRATION REQUESTS
-- Who can do what:
--   SELECT  → super_admin only (displayed in admin portal)
--   INSERT  → anyone including unauthenticated (public registration form)
--   UPDATE  → super_admin only (approve/reject)
--   DELETE  → super_admin only
-- ==============================================================================

ALTER TABLE registration_requests ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'registration_requests' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.registration_requests', pol.policyname);
  END LOOP;
END $$;

-- Super admin reads all registration requests
CREATE POLICY "registration_requests_superadmin_read"
  ON registration_requests FOR SELECT
  USING (get_my_role() = 'super_admin');

-- Public INSERT (unauthenticated registration form)
CREATE POLICY "registration_requests_public_insert"
  ON registration_requests FOR INSERT
  WITH CHECK (true);

-- Super admin approves/rejects (UPDATE status field)
CREATE POLICY "registration_requests_superadmin_update"
  ON registration_requests FOR UPDATE
  USING (get_my_role() = 'super_admin');

-- Super admin deletes
CREATE POLICY "registration_requests_superadmin_delete"
  ON registration_requests FOR DELETE
  USING (get_my_role() = 'super_admin');


-- ==============================================================================
-- 5. TEACHER DIARIES
-- Who can do what:
--   SELECT  → teachers see only their own diaries;
--             admins see all diaries for their school
--   INSERT  → any user in the school
--   UPDATE  → only the diary owner OR admin of the same school
--   DELETE  → only the diary owner OR admin of the same school
-- ==============================================================================

ALTER TABLE teacher_diaries ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'teacher_diaries' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.teacher_diaries', pol.policyname);
  END LOOP;
END $$;

-- Teachers see own diaries; admins see all in their school
CREATE POLICY "teacher_diaries_read"
  ON teacher_diaries FOR SELECT
  USING (
    school_id::text = (get_my_school_id())::text
    AND (
      user_id::text = (auth.uid())::text
      OR get_my_role() IN ('admin', 'super_admin')
    )
  );

-- Any authenticated user in the school can create diary entries
CREATE POLICY "teacher_diaries_insert"
  ON teacher_diaries FOR INSERT
  WITH CHECK (
    school_id::text = (get_my_school_id())::text
  );

-- Owner or admin can update
CREATE POLICY "teacher_diaries_update"
  ON teacher_diaries FOR UPDATE
  USING (
    school_id::text = (get_my_school_id())::text
    AND (
      user_id::text = (auth.uid())::text
      OR get_my_role() IN ('admin', 'super_admin')
    )
  );

-- Owner or admin can delete
CREATE POLICY "teacher_diaries_delete"
  ON teacher_diaries FOR DELETE
  USING (
    school_id::text = (get_my_school_id())::text
    AND (
      user_id::text = (auth.uid())::text
      OR get_my_role() IN ('admin', 'super_admin')
    )
  );


-- ==============================================================================
-- VERIFICATION — Run these to confirm everything is in place
-- ==============================================================================

SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'schools', 'academic_years', 'support_queries',
    'registration_requests', 'teacher_diaries'
  )
ORDER BY tablename, cmd, policyname;
