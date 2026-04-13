-- ============================================================
-- NobleMinds — FIX PROFILES RLS
-- Run this in Supabase SQL Editor to allow Admins to manage profiles.
-- ============================================================

-- 1. Drop the existing update policy
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON profiles; 
DROP POLICY IF EXISTS "Admins can manage profiles" ON profiles;

-- 2. Create flexible Update policy: 
-- Users can update themselves, OR super admin (role='admin') can update anyone.
CREATE POLICY "Users and Admins can update profiles" ON profiles
    FOR UPDATE TO authenticated
    USING (
        auth.uid() = id 
        OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    );

-- 3. Create Delete policy:
-- Only super admins can manually delete profiles via the profiles table.
CREATE POLICY "Admins can delete profiles" ON profiles
    FOR DELETE TO authenticated
    USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    );
