-- ==============================================================================
-- NOBLEMINDS — TEACHER RECORD ISOLATION SCRIPT
-- Run this script in your Supabase SQL Editor
-- ==============================================================================

-- 1. Add user_id column to all 4 record tables
ALTER TABLE observations         ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE counselling_records  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE movements            ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE parent_interactions  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- 2. Drop old permissive policies (so they don't override our new secure ones)
DROP POLICY IF EXISTS "Enable all for observations"        ON observations;
DROP POLICY IF EXISTS "Enable all for counselling_records" ON counselling_records;
DROP POLICY IF EXISTS "Enable all for movements"           ON movements;
DROP POLICY IF EXISTS "Enable all for parent_interactions" ON parent_interactions;

-- 3. Create New secure policies
-- Rule: Teachers can only see records for their own school AND (where user_id matches their own OR is null for old records)

CREATE POLICY "Teacher owns observations"
  ON observations FOR ALL
  USING (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    AND (user_id IS NULL OR user_id = auth.uid())
  )
  WITH CHECK (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Teacher owns counselling"
  ON counselling_records FOR ALL
  USING (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    AND (user_id IS NULL OR user_id = auth.uid())
  )
  WITH CHECK (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Teacher owns movements"
  ON movements FOR ALL
  USING (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    AND (user_id IS NULL OR user_id = auth.uid())
  )
  WITH CHECK (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Teacher owns interactions"
  ON parent_interactions FOR ALL
  USING (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    AND (user_id IS NULL OR user_id = auth.uid())
  )
  WITH CHECK (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
  );
