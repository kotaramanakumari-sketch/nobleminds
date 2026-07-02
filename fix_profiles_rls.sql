-- ==============================================================================
-- NOBLEMINDS — FIX PROFILES TABLE RLS
-- Run this in Supabase SQL Editor
-- ==============================================================================

-- Step 1: Enable RLS on profiles (in case it's off)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop EVERY existing policy on profiles (dynamic cleanup)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', r.policyname);
    END LOOP;
END $$;

-- Step 3: Allow users to read their own profile (CRITICAL for login)
CREATE POLICY "Allow own profile read"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- Step 4: Allow super_admin to read ALL profiles (needed for Users tab in admin portal)
CREATE POLICY "Super admin reads all profiles"
  ON profiles FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
  );

-- Step 5: Allow super_admin to update any profile (for role assignment)
CREATE POLICY "Super admin updates any profile"
  ON profiles FOR UPDATE
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
  );

-- Step 6: Allow users to update their OWN profile (for settings page)
CREATE POLICY "Allow own profile update"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- Step 7: Allow insert (for new user signups)
CREATE POLICY "Allow profile insert"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- Verify: Check your profile role
SELECT id, name, email, role FROM profiles WHERE email = 'kotaramanakumari@gmail.com';
