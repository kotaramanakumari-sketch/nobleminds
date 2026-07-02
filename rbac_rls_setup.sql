-- ==============================================================================
-- NOBLEMINDS — RBAC & RLS POLICY UPDATE
-- Run this in Supabase SQL Editor
-- ==============================================================================

-- 1. PROMOTE YOURSELF TO SUPER ADMIN
-- (This promotes the user who is currently 'admin' to 'super_admin')
-- If you have multiple admins, you might need to adjust this, but for a single owner this works.
UPDATE profiles SET role = 'super_admin' WHERE role = 'admin';

-- 2. DROP THE STRICT POLICIES WE CREATED EARLIER
DROP POLICY IF EXISTS "Teacher owns observations" ON observations;
DROP POLICY IF EXISTS "Teacher owns counselling" ON counselling_records;
DROP POLICY IF EXISTS "Teacher owns movements" ON movements;
DROP POLICY IF EXISTS "Teacher owns interactions" ON parent_interactions;

-- 3. CREATE THE NEW RBAC POLICIES
-- Rule: Teachers see only their own. Admins and Super Admins see everything for the school.

CREATE POLICY "Teacher owns or Admin sees all"
  ON observations FOR ALL
  USING (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    AND (
      user_id IS NULL 
      OR user_id = auth.uid() 
      OR 'admin' = (SELECT role FROM profiles WHERE id = auth.uid())
      OR 'super_admin' = (SELECT role FROM profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Teacher owns or Admin sees all"
  ON counselling_records FOR ALL
  USING (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    AND (
      user_id IS NULL 
      OR user_id = auth.uid() 
      OR 'admin' = (SELECT role FROM profiles WHERE id = auth.uid())
      OR 'super_admin' = (SELECT role FROM profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Teacher owns or Admin sees all"
  ON movements FOR ALL
  USING (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    AND (
      user_id IS NULL 
      OR user_id = auth.uid() 
      OR 'admin' = (SELECT role FROM profiles WHERE id = auth.uid())
      OR 'super_admin' = (SELECT role FROM profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Teacher owns or Admin sees all"
  ON parent_interactions FOR ALL
  USING (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    AND (
      user_id IS NULL 
      OR user_id = auth.uid() 
      OR 'admin' = (SELECT role FROM profiles WHERE id = auth.uid())
      OR 'super_admin' = (SELECT role FROM profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
  );

-- ==============================================================================
-- 4. PROFILES TABLE RLS — Allow Super Admin to manage all user profiles
-- ==============================================================================

-- Allow everyone to read their own profile
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Super admin manages all profiles" ON profiles;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid() OR 'super_admin' = (SELECT role FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Super admin manages all profiles"
  ON profiles FOR UPDATE
  USING ('super_admin' = (SELECT role FROM profiles WHERE id = auth.uid()));
