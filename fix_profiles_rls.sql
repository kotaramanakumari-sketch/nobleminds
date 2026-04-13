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
-- Users can always update their OWN profile.
-- The Super Admin (checked via email claim to avoid recursion) can update ANY profile.
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Super Admin can update all profiles" ON profiles
    FOR UPDATE TO authenticated
    USING (lower(auth.jwt() ->> 'email') = 'kotaramanakumari@gmail.com')
    WITH CHECK (lower(auth.jwt() ->> 'email') = 'kotaramanakumari@gmail.com');

-- 3. Create Delete policy:
CREATE POLICY "Super Admin can delete profiles" ON profiles
    FOR DELETE TO authenticated
    USING (lower(auth.jwt() ->> 'email') = 'kotaramanakumari@gmail.com');

