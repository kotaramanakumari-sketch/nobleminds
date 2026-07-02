-- ============================================================
-- NobleMinds: Admin Staff Management RLS Fix
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Step 1: Allow admins and super_admins to read all profiles
-- in their own school (needed for Staff Management tab)
DROP POLICY IF EXISTS "admin_can_read_school_profiles" ON profiles;

CREATE POLICY "admin_can_read_school_profiles"
ON profiles
FOR SELECT
USING (
  school_id = (
    SELECT school_id FROM profiles WHERE id = auth.uid() LIMIT 1
  )
  AND (
    SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1
  ) IN ('admin', 'super_admin')
);

-- Step 2: Also ensure regular users can still read their own profile
-- (this should already exist, but added here as a safety net)
DROP POLICY IF EXISTS "users_read_own_profile" ON profiles;

CREATE POLICY "users_read_own_profile"
ON profiles
FOR SELECT
USING (id = auth.uid());

-- ============================================================
-- Verify: After running, check policies are created correctly
-- ============================================================
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'profiles';
