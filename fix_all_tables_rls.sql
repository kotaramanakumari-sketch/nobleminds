-- ==============================================================================
-- NOBLEMINDS — COMPLETE RLS SECURITY MODEL SCRIPT
-- Enforces:
-- 1. Super Admin: Access to ALL students, users, and records across all schools.
-- 2. School Admin (Principal): Access to ALL students, staff profiles, and records in their school.
-- 3. Teacher (User): Access to students in their school, but CANNOT see other teachers' records or profiles.
-- Run this script in Supabase SQL Editor!
-- ==============================================================================

-- Step 1: Drop existing helper functions with CASCADE (cleans old policies)
DROP FUNCTION IF EXISTS public.get_my_role() CASCADE;
DROP FUNCTION IF EXISTS public.get_my_school_id() CASCADE;
DROP FUNCTION IF EXISTS public.is_super_admin() CASCADE;

-- Step 2: Recreate SECURITY DEFINER helper functions (prevents policy recursion)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT school_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Step 3: Enable RLS on ALL application tables
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.counselling_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.teacher_diaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.parent_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.registration_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.support_queries ENABLE ROW LEVEL SECURITY;

-- Step 4: Dynamically drop ALL existing policies across all application tables
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename IN (
            'profiles', 'students', 'schools', 'academic_years',
            'observations', 'counselling_records', 'movements',
            'teacher_diaries', 'parent_interactions',
            'registration_requests', 'support_queries'
          )
    ) 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- ==============================================================================
-- Step 5: Create Role-Isolated Policies
-- ==============================================================================

-- 1. PROFILES
-- Super Admin sees all profiles.
-- School Admin sees staff profiles in their school.
-- Teacher (User) sees ONLY their own profile.
CREATE POLICY "profiles_access_policy"
  ON public.profiles FOR ALL
  TO authenticated
  USING (
    id = auth.uid()
    OR public.get_my_role() = 'super_admin'
    OR (public.get_my_role() = 'admin' AND school_id::text = public.get_my_school_id()::text)
  )
  WITH CHECK (
    id = auth.uid()
    OR public.get_my_role() = 'super_admin'
    OR (public.get_my_role() = 'admin' AND school_id::text = public.get_my_school_id()::text)
  );

-- 2. STUDENTS
-- Super Admin sees all students.
-- School Admin and Teachers see all students in their school.
CREATE POLICY "students_access_policy"
  ON public.students FOR ALL
  TO authenticated
  USING (
    public.get_my_role() = 'super_admin'
    OR (public.get_my_school_id() IS NOT NULL AND school_id::text = public.get_my_school_id()::text)
  )
  WITH CHECK (
    public.get_my_role() = 'super_admin'
    OR (public.get_my_school_id() IS NOT NULL AND school_id::text = public.get_my_school_id()::text)
  );

-- 3. SCHOOLS
CREATE POLICY "schools_select_policy"
  ON public.schools FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "schools_write_policy"
  ON public.schools FOR ALL
  TO authenticated
  USING (
    public.get_my_role() = 'super_admin'
    OR (public.get_my_role() = 'admin' AND id::text = public.get_my_school_id()::text)
  )
  WITH CHECK (
    public.get_my_role() = 'super_admin'
    OR (public.get_my_role() = 'admin' AND id::text = public.get_my_school_id()::text)
  );

-- 4. ACADEMIC YEARS
CREATE POLICY "academic_years_access_policy"
  ON public.academic_years FOR ALL
  TO authenticated
  USING (
    public.get_my_role() = 'super_admin'
    OR (public.get_my_school_id() IS NOT NULL AND school_id::text = public.get_my_school_id()::text)
  )
  WITH CHECK (
    public.get_my_role() = 'super_admin'
    OR (public.get_my_school_id() IS NOT NULL AND school_id::text = public.get_my_school_id()::text)
  );

-- 5. OBSERVATIONS (Restricted: Teachers see ONLY their own records)
CREATE POLICY "observations_access_policy"
  ON public.observations FOR ALL
  TO authenticated
  USING (
    public.get_my_role() = 'super_admin'
    OR (
      public.get_my_school_id() IS NOT NULL 
      AND school_id::text = public.get_my_school_id()::text
      AND (
        public.get_my_role() = 'admin'
        OR user_id IS NULL
        OR user_id::text = (auth.uid())::text
      )
    )
  )
  WITH CHECK (
    public.get_my_role() = 'super_admin'
    OR (
      public.get_my_school_id() IS NOT NULL 
      AND school_id::text = public.get_my_school_id()::text
      AND (
        public.get_my_role() = 'admin'
        OR user_id IS NULL
        OR user_id::text = (auth.uid())::text
      )
    )
  );

-- 6. COUNSELLING RECORDS (Restricted: Teachers see ONLY their own records)
CREATE POLICY "counselling_access_policy"
  ON public.counselling_records FOR ALL
  TO authenticated
  USING (
    public.get_my_role() = 'super_admin'
    OR (
      public.get_my_school_id() IS NOT NULL 
      AND school_id::text = public.get_my_school_id()::text
      AND (
        public.get_my_role() = 'admin'
        OR user_id IS NULL
        OR user_id::text = (auth.uid())::text
      )
    )
  )
  WITH CHECK (
    public.get_my_role() = 'super_admin'
    OR (
      public.get_my_school_id() IS NOT NULL 
      AND school_id::text = public.get_my_school_id()::text
      AND (
        public.get_my_role() = 'admin'
        OR user_id IS NULL
        OR user_id::text = (auth.uid())::text
      )
    )
  );

-- 7. MOVEMENTS (Restricted: Teachers see ONLY their own records)
CREATE POLICY "movements_access_policy"
  ON public.movements FOR ALL
  TO authenticated
  USING (
    public.get_my_role() = 'super_admin'
    OR (
      public.get_my_school_id() IS NOT NULL 
      AND school_id::text = public.get_my_school_id()::text
      AND (
        public.get_my_role() = 'admin'
        OR user_id IS NULL
        OR user_id::text = (auth.uid())::text
      )
    )
  )
  WITH CHECK (
    public.get_my_role() = 'super_admin'
    OR (
      public.get_my_school_id() IS NOT NULL 
      AND school_id::text = public.get_my_school_id()::text
      AND (
        public.get_my_role() = 'admin'
        OR user_id IS NULL
        OR user_id::text = (auth.uid())::text
      )
    )
  );

-- 8. TEACHER DIARIES (Restricted: Teachers see ONLY their own records)
CREATE POLICY "teacher_diaries_access_policy"
  ON public.teacher_diaries FOR ALL
  TO authenticated
  USING (
    public.get_my_role() = 'super_admin'
    OR (
      public.get_my_school_id() IS NOT NULL 
      AND school_id::text = public.get_my_school_id()::text
      AND (
        public.get_my_role() = 'admin'
        OR user_id IS NULL
        OR user_id::text = (auth.uid())::text
      )
    )
  )
  WITH CHECK (
    public.get_my_role() = 'super_admin'
    OR (
      public.get_my_school_id() IS NOT NULL 
      AND school_id::text = public.get_my_school_id()::text
      AND (
        public.get_my_role() = 'admin'
        OR user_id IS NULL
        OR user_id::text = (auth.uid())::text
      )
    )
  );

-- 9. PARENT INTERACTIONS (Restricted: Teachers see ONLY their own records)
CREATE POLICY "parent_interactions_access_policy"
  ON public.parent_interactions FOR ALL
  TO authenticated
  USING (
    public.get_my_role() = 'super_admin'
    OR (
      public.get_my_school_id() IS NOT NULL 
      AND school_id::text = public.get_my_school_id()::text
      AND (
        public.get_my_role() = 'admin'
        OR user_id IS NULL
        OR user_id::text = (auth.uid())::text
      )
    )
  )
  WITH CHECK (
    public.get_my_role() = 'super_admin'
    OR (
      public.get_my_school_id() IS NOT NULL 
      AND school_id::text = public.get_my_school_id()::text
      AND (
        public.get_my_role() = 'admin'
        OR user_id IS NULL
        OR user_id::text = (auth.uid())::text
      )
    )
  );

-- 10. REGISTRATION REQUESTS
CREATE POLICY "registration_requests_insert"
  ON public.registration_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "registration_requests_manage"
  ON public.registration_requests FOR ALL
  TO authenticated
  USING (public.get_my_role() = 'super_admin')
  WITH CHECK (public.get_my_role() = 'super_admin');

-- 11. SUPPORT QUERIES
CREATE POLICY "support_queries_insert"
  ON public.support_queries FOR INSERT
  WITH CHECK (true);

CREATE POLICY "support_queries_manage"
  ON public.support_queries FOR ALL
  TO authenticated
  USING (public.get_my_role() = 'super_admin')
  WITH CHECK (public.get_my_role() = 'super_admin');

-- Step 6: Verification Query
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, cmd;
