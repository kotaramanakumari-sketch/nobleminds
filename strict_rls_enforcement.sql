-- ==============================================================================
-- NOBLEMINDS — STRICT RLS ENFORCEMENT SCRIPT
-- Run this in Supabase SQL Editor
-- ==============================================================================

-- 1. FORCE ENABLE ROW LEVEL SECURITY
-- If RLS was never turned on, policies are completely ignored!
ALTER TABLE observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE counselling_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE movements ENABLE ROW LEVEL SECURITY;

-- 2. TO BE ABSOLUTELY SURE, WE DROP ALL KNOWN POLICIES 
DROP POLICY IF EXISTS "School Isolation Policy" ON observations;
DROP POLICY IF EXISTS "Teacher owns observations" ON observations;
DROP POLICY IF EXISTS "Enable all for observations" ON observations;

DROP POLICY IF EXISTS "School Isolation Policy" ON counselling_records;
DROP POLICY IF EXISTS "Teacher owns counselling" ON counselling_records;
DROP POLICY IF EXISTS "Enable all for counselling_records" ON counselling_records;

DROP POLICY IF EXISTS "School Isolation Policy" ON movements;
DROP POLICY IF EXISTS "Teacher owns movements" ON movements;
DROP POLICY IF EXISTS "Enable all for movements" ON movements;

DROP POLICY IF EXISTS "School Isolation Policy" ON parent_interactions;
DROP POLICY IF EXISTS "Teacher owns interactions" ON parent_interactions;
DROP POLICY IF EXISTS "Enable all for parent_interactions" ON parent_interactions;

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
