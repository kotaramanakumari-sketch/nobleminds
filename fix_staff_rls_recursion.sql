-- ============================================================
-- EMERGENCY FIX v4 (FINAL): Correct types confirmed
-- id = uuid, school_id = uuid, auth.uid() = uuid
-- Run this in Supabase SQL Editor
-- ============================================================

-- Step 1: Drop ALL existing policies on profiles
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'profiles' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

-- Step 2: Drop old helper functions
DROP FUNCTION IF EXISTS get_my_role();
DROP FUNCTION IF EXISTS get_my_school_id();
DROP FUNCTION IF EXISTS get_my_profile();

-- Step 3: Create helper functions with correct return types
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

-- Step 4: Recreate all policies with correct types (uuid = uuid, no casting)

-- Policy 1: Everyone reads their own profile
CREATE POLICY "read_own_profile"
ON public.profiles FOR SELECT
USING (id = auth.uid());

-- Policy 2: Admins read all profiles in their school
CREATE POLICY "admin_read_school_profiles"
ON public.profiles FOR SELECT
USING (
  get_my_role() IN ('admin', 'super_admin')
  AND school_id = get_my_school_id()
);

-- Policy 3: Super Admins read all profiles everywhere
CREATE POLICY "super_admin_read_all_profiles"
ON public.profiles FOR SELECT
USING (
  get_my_role() = 'super_admin'
);

-- Policy 4: Users update own profile
CREATE POLICY "users_update_own_profile"
ON public.profiles FOR UPDATE
USING (id = auth.uid());

-- Policy 5: Users insert own profile (on signup)
CREATE POLICY "users_insert_own_profile"
ON public.profiles FOR INSERT
WITH CHECK (id = auth.uid());

-- ============================================================
-- Verify - should show 5 policies
-- ============================================================
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY cmd, policyname;
