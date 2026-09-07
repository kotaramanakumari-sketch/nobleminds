-- ==============================================================================
-- NOBLEMINDS — Allow Super Admin to Update Any User Profile (Role Assignment)
-- Run this in Supabase SQL Editor
-- ==============================================================================

-- Drop old super admin update policy first
DROP POLICY IF EXISTS "Super admin updates any profile" ON profiles;
DROP POLICY IF EXISTS "Super admin manages all profiles" ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;

-- Create SECURITY DEFINER function to check role safely
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Create update policy using SECURITY DEFINER function (no recursion)
CREATE POLICY "profiles_update_policy"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    OR public.get_my_role() = 'super_admin'
    OR (public.get_my_role() = 'admin' AND school_id = public.get_my_school_id())
  )
  WITH CHECK (
    id = auth.uid()
    OR public.get_my_role() = 'super_admin'
    OR (public.get_my_role() = 'admin' AND school_id = public.get_my_school_id())
  );

-- Verify policies on profiles table
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'profiles';
