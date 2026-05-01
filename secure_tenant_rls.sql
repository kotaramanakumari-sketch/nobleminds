-- ============================================================
-- NobleMinds — SECURE TENANT LEVEL ACCESS (RLS)
-- Run this in your Supabase SQL Editor to secure tenant data.
-- ============================================================

-- helper function to fetch current authenticated user's school_id to avoid recursion
CREATE OR REPLACE FUNCTION get_user_school_id()
RETURNS UUID AS $$
  SELECT school_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- helper function to fetch current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- helper function to identify if current user is Super Admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT get_user_role() = 'admin' OR lower(auth.jwt() ->> 'email') = 'kotaramanakumari@gmail.com';
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;


-- Clear existing overly-permissive policies
DROP POLICY IF EXISTS "Allow all for authenticated" ON schools;
DROP POLICY IF EXISTS "Allow all for authenticated" ON academic_years;
DROP POLICY IF EXISTS "Allow all for authenticated" ON students;
DROP POLICY IF EXISTS "Allow all for authenticated" ON observations;
DROP POLICY IF EXISTS "Allow all for authenticated" ON counselling_records;
DROP POLICY IF EXISTS "Allow all for authenticated" ON movements;
DROP POLICY IF EXISTS "Allow all for authenticated" ON teacher_diaries;


-- 1. SCHOOLS Secure Policies
CREATE POLICY "Schools access policy" ON schools
    FOR ALL TO authenticated
    USING (id = get_user_school_id() OR is_admin())
    WITH CHECK (id = get_user_school_id() OR is_admin());

-- 2. ACADEMIC YEARS Secure Policies
CREATE POLICY "Academic years access policy" ON academic_years
    FOR ALL TO authenticated
    USING (school_id = get_user_school_id() OR is_admin())
    WITH CHECK (school_id = get_user_school_id() OR is_admin());

-- 3. STUDENTS Secure Policies
CREATE POLICY "Students access policy" ON students
    FOR ALL TO authenticated
    USING (school_id = get_user_school_id() OR is_admin())
    WITH CHECK (school_id = get_user_school_id() OR is_admin());

-- 4. OBSERVATIONS Secure Policies
CREATE POLICY "Observations access policy" ON observations
    FOR ALL TO authenticated
    USING (school_id = get_user_school_id() OR is_admin())
    WITH CHECK (school_id = get_user_school_id() OR is_admin());

-- 5. COUNSELLING Secure Policies
CREATE POLICY "Counselling records access policy" ON counselling_records
    FOR ALL TO authenticated
    USING (school_id = get_user_school_id() OR is_admin())
    WITH CHECK (school_id = get_user_school_id() OR is_admin());

-- 6. MOVEMENTS Secure Policies
CREATE POLICY "Movements access policy" ON movements
    FOR ALL TO authenticated
    USING (school_id = get_user_school_id() OR is_admin())
    WITH CHECK (school_id = get_user_school_id() OR is_admin());

-- 7. TEACHER DIARIES Secure Policies
CREATE POLICY "Teacher diaries access policy" ON teacher_diaries
    FOR ALL TO authenticated
    USING (school_id = get_user_school_id() OR is_admin())
    WITH CHECK (school_id = get_user_school_id() OR is_admin());
