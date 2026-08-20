-- ==============================================================================
-- NOBLEMINDS — FIX SUPER ADMIN HISTORY TIMELINE RLS POLICIES
-- Run this in your Supabase SQL Editor
-- ==============================================================================

-- 1. Ensure RLS is enabled on all timeline and student tables
ALTER TABLE observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE counselling_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- 2. DYNAMICALLY DROP EXISTING POLICIES ON TIMELINE & STUDENT TABLES
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE tablename IN ('observations', 'counselling_records', 'movements', 'parent_interactions', 'students')
          AND schemaname = 'public'
    ) 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- 3. ENSURE HELPER FUNCTIONS EXIST
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_my_school_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT school_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- 4. CREATE POLICIES FOR OBSERVATIONS
CREATE POLICY "Teacher owns or Admin sees all"
  ON observations FOR ALL
  USING (
    get_my_role() = 'super_admin'
    OR (
      school_id::text = (get_my_school_id())::text
      AND (
        user_id IS NULL 
        OR user_id::text = (auth.uid())::text 
        OR get_my_role() = 'admin'
      )
    )
  )
  WITH CHECK (
    get_my_role() = 'super_admin'
    OR (
      school_id::text = (get_my_school_id())::text
      AND (
        user_id IS NULL 
        OR user_id::text = (auth.uid())::text 
        OR get_my_role() = 'admin'
      )
    )
  );

-- 5. CREATE POLICIES FOR COUNSELLING RECORDS
CREATE POLICY "Teacher owns or Admin sees all"
  ON counselling_records FOR ALL
  USING (
    get_my_role() = 'super_admin'
    OR (
      school_id::text = (get_my_school_id())::text
      AND (
        user_id IS NULL 
        OR user_id::text = (auth.uid())::text 
        OR get_my_role() = 'admin'
      )
    )
  )
  WITH CHECK (
    get_my_role() = 'super_admin'
    OR (
      school_id::text = (get_my_school_id())::text
      AND (
        user_id IS NULL 
        OR user_id::text = (auth.uid())::text 
        OR get_my_role() = 'admin'
      )
    )
  );

-- 6. CREATE POLICIES FOR MOVEMENTS
CREATE POLICY "Teacher owns or Admin sees all"
  ON movements FOR ALL
  USING (
    get_my_role() = 'super_admin'
    OR (
      school_id::text = (get_my_school_id())::text
      AND (
        user_id IS NULL 
        OR user_id::text = (auth.uid())::text 
        OR get_my_role() = 'admin'
      )
    )
  )
  WITH CHECK (
    get_my_role() = 'super_admin'
    OR (
      school_id::text = (get_my_school_id())::text
      AND (
        user_id IS NULL 
        OR user_id::text = (auth.uid())::text 
        OR get_my_role() = 'admin'
      )
    )
  );

-- 7. CREATE POLICIES FOR PARENT INTERACTIONS
CREATE POLICY "Teacher owns or Admin sees all"
  ON parent_interactions FOR ALL
  USING (
    get_my_role() = 'super_admin'
    OR (
      school_id::text = (get_my_school_id())::text
      AND (
        user_id IS NULL 
        OR user_id::text = (auth.uid())::text 
        OR get_my_role() = 'admin'
      )
    )
  )
  WITH CHECK (
    get_my_role() = 'super_admin'
    OR (
      school_id::text = (get_my_school_id())::text
      AND (
        user_id IS NULL 
        OR user_id::text = (auth.uid())::text 
        OR get_my_role() = 'admin'
      )
    )
  );

-- 8. CREATE POLICIES FOR STUDENTS
CREATE POLICY "Users can see students in their school"
  ON students FOR ALL
  USING (
    get_my_role() = 'super_admin'
    OR school_id::text = (get_my_school_id())::text
  )
  WITH CHECK (
    get_my_role() = 'super_admin'
    OR school_id::text = (get_my_school_id())::text
  );

-- ==============================================================================
-- VERIFICATION
-- Run this query after executing the above script to verify active policies:
-- ==============================================================================
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('observations', 'counselling_records', 'movements', 'parent_interactions', 'students')
ORDER BY tablename, policyname;
