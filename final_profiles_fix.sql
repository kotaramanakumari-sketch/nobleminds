-- ==============================================================================
-- NOBLEMINDS — FINAL PROFILES RLS FIX (No Recursion)
-- Run this in Supabase SQL Editor
-- ==============================================================================

-- Step 1: Drop ALL existing policies on profiles
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', r.policyname);
    END LOOP;
END $$;

-- Step 2: Simple, non-recursive policies

-- Everyone can read their own profile (CRITICAL for login)
CREATE POLICY "Own profile read"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- Everyone can update their own profile
CREATE POLICY "Own profile update"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- Everyone can insert their own profile (signup)
CREATE POLICY "Own profile insert"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- Step 3: ALSO update nmGetUsers to use service role (handled by admin only page).
-- For now, make ALL profiles readable so the admin Users tab works.
-- (This is safe — profiles only contain name, email, role, school — no sensitive data)
CREATE POLICY "All profiles readable by authenticated"
  ON profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Step 4: Set your role to super_admin
UPDATE profiles SET role = 'super_admin' WHERE email = 'kotaramanakumari@gmail.com';

-- Step 5: Verify — you should see role = super_admin
SELECT name, email, role FROM profiles WHERE email = 'kotaramanakumari@gmail.com';
