-- ==============================================================================
-- NOBLEMINDS — Allow Super Admin to Update Any User Profile (Role Assignment)
-- Run this in Supabase SQL Editor
-- ==============================================================================

-- Drop any old super admin update policy first
DROP POLICY IF EXISTS "Super admin updates any profile" ON profiles;
DROP POLICY IF EXISTS "Super admin manages all profiles" ON profiles;
DROP POLICY IF EXISTS "Super admin updates any profile" ON profiles;

-- Create the policy:
-- The inner SELECT (WHERE id = auth.uid()) is safe — it is covered by "Own profile read"
-- so there is NO infinite recursion here.
CREATE POLICY "Super admin updates any profile"
  ON profiles FOR UPDATE
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
  );

-- Verify policies on profiles table
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'profiles';
