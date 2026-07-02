-- ==============================================================================
-- NOBLEMINDS — ULTIMATE RLS CLEANUP SCRIPT
-- Run this in Supabase SQL Editor
-- ==============================================================================

-- 1. Ensure RLS is enabled
ALTER TABLE observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE counselling_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_interactions ENABLE ROW LEVEL SECURITY;

-- 2. DYNAMICALLY DROP EVERY SINGLE POLICY ON THESE TABLES
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE tablename IN ('observations', 'counselling_records', 'movements', 'parent_interactions')) 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- 3. RECREATE ONLY THE STRICT POLICIES
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
