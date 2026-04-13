-- ============================================================
-- NobleMinds — FIX PROFILES RLS
-- Run this in Supabase SQL Editor to allow Admins to manage profiles.
-- ============================================================

-- 1. Drop old policies
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON profiles; 
DROP POLICY IF EXISTS "Admins can manage profiles" ON profiles;
DROP POLICY IF EXISTS "Users and Admins can update profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;

-- 2. Create foolproof Update policy: 
-- Users can update themselves, OR super admin (via JWT email) can update anyone.
-- This avoids recursive queries to the profiles table.
CREATE POLICY "Users and Admins can update profiles" ON profiles
    FOR UPDATE TO authenticated
    USING (
        auth.uid() = id 
        OR auth.jwt() ->> 'email' = 'kotaramanakumari@gmail.com'
    )
    WITH CHECK (
        auth.uid() = id 
        OR auth.jwt() ->> 'email' = 'kotaramanakumari@gmail.com'
    );

-- 3. Create Delete policy:
CREATE POLICY "Admins can delete profiles" ON profiles
    FOR DELETE TO authenticated
    USING (
        auth.jwt() ->> 'email' = 'kotaramanakumari@gmail.com'
    );
