-- ==============================================================================
-- NOBLEMINDS — FINAL SECURE RLS SCRIPT (TYPE-SAFE)
-- Run this in Supabase SQL Editor
-- ==============================================================================

-- 1. DROP THE OLD POLICIES THAT CAUSE RECURSION OR LEAK DATA
DROP POLICY IF EXISTS "Teacher owns observations" ON observations;
DROP POLICY IF EXISTS "Teacher owns or Admin sees all" ON observations;
DROP POLICY IF EXISTS "School Isolation Policy" ON observations;
DROP POLICY IF EXISTS "School records isolation" ON observations;

DROP POLICY IF EXISTS "Teacher owns counselling" ON counselling_records;
DROP POLICY IF EXISTS "Teacher owns or Admin sees all" ON counselling_records;
DROP POLICY IF EXISTS "School Isolation Policy" ON counselling_records;
DROP POLICY IF EXISTS "School records isolation" ON counselling_records;

DROP POLICY IF EXISTS "Teacher owns movements" ON movements;
DROP POLICY IF EXISTS "Teacher owns or Admin sees all" ON movements;
DROP POLICY IF EXISTS "School Isolation Policy" ON movements;
DROP POLICY IF EXISTS "School records isolation" ON movements;

DROP POLICY IF EXISTS "Teacher owns interactions" ON parent_interactions;
DROP POLICY IF EXISTS "Teacher owns or Admin sees all" ON parent_interactions;
DROP POLICY IF EXISTS "School Isolation Policy" ON parent_interactions;
DROP POLICY IF EXISTS "School records isolation" ON parent_interactions;

-- 2. CREATE SECURE POLICIES USING EXISTING HELPER FUNCTIONS
-- We cast ::text to ensure no "uuid = text" errors occur if the tables were created with text columns.

CREATE POLICY "Teacher owns or Admin sees all"
  ON observations FOR ALL
  USING (
    school_id::text = (get_my_school_id())::text
    AND (
      user_id IS NULL 
      OR user_id::text = (auth.uid())::text 
      OR get_my_role() IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    school_id::text = (get_my_school_id())::text
    AND (
      user_id IS NULL 
      OR user_id::text = (auth.uid())::text 
      OR get_my_role() IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Teacher owns or Admin sees all"
  ON counselling_records FOR ALL
  USING (
    school_id::text = (get_my_school_id())::text
    AND (
      user_id IS NULL 
      OR user_id::text = (auth.uid())::text 
      OR get_my_role() IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    school_id::text = (get_my_school_id())::text
    AND (
      user_id IS NULL 
      OR user_id::text = (auth.uid())::text 
      OR get_my_role() IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Teacher owns or Admin sees all"
  ON movements FOR ALL
  USING (
    school_id::text = (get_my_school_id())::text
    AND (
      user_id IS NULL 
      OR user_id::text = (auth.uid())::text 
      OR get_my_role() IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    school_id::text = (get_my_school_id())::text
    AND (
      user_id IS NULL 
      OR user_id::text = (auth.uid())::text 
      OR get_my_role() IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Teacher owns or Admin sees all"
  ON parent_interactions FOR ALL
  USING (
    school_id::text = (get_my_school_id())::text
    AND (
      user_id IS NULL 
      OR user_id::text = (auth.uid())::text 
      OR get_my_role() IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    school_id::text = (get_my_school_id())::text
    AND (
      user_id IS NULL 
      OR user_id::text = (auth.uid())::text 
      OR get_my_role() IN ('admin', 'super_admin')
    )
  );

-- 3. STUDENTS TABLE RLS
DROP POLICY IF EXISTS "Teacher sees all students" ON students;
DROP POLICY IF EXISTS "Users can see students in their school" ON students;

CREATE POLICY "Users can see students in their school"
  ON students FOR ALL
  USING (school_id::text = (get_my_school_id())::text)
  WITH CHECK (school_id::text = (get_my_school_id())::text);
