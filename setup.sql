-- ============================================================
-- NobleMinds — FULL DATABASE SETUP & SCHEMA
-- ============================================================

-- STEP 1: DROP all existing tables (must be in child-first order)
DROP TABLE IF EXISTS teacher_diaries     CASCADE;
DROP TABLE IF EXISTS movements             CASCADE;
DROP TABLE IF EXISTS counselling_records   CASCADE;
DROP TABLE IF EXISTS observations          CASCADE;
DROP TABLE IF EXISTS support_queries       CASCADE;
DROP TABLE IF EXISTS registration_requests CASCADE;
DROP TABLE IF EXISTS profiles              CASCADE;
DROP TABLE IF EXISTS students              CASCADE;
DROP TABLE IF EXISTS academic_years        CASCADE;
DROP TABLE IF EXISTS schools               CASCADE;

-- STEP 2: CREATE tables

-- 1. SCHOOLS
CREATE TABLE schools (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    udise       TEXT UNIQUE,
    name        TEXT NOT NULL,
    code        TEXT,
    address     TEXT,
    principal   TEXT,
    phone       TEXT,
    email       TEXT,
    established INTEGER,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ACADEMIC YEARS
CREATE TABLE academic_years (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id    UUID REFERENCES schools(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    is_active    BOOLEAN DEFAULT FALSE,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 3. STUDENTS
CREATE TABLE students (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id        UUID REFERENCES schools(id) ON DELETE CASCADE,
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL,
    admission_number TEXT,
    full_name        TEXT NOT NULL,
    class            TEXT,
    section          TEXT,
    house            TEXT,
    dob              DATE,
    gender           TEXT,
    religion         TEXT,
    caste            TEXT,
    address          TEXT,
    phone            TEXT,
    email            TEXT,
    aadhar           TEXT,
    pen              TEXT,
    apaar_number     TEXT,
    father_name      TEXT,
    father_phone     TEXT,
    father_occupation TEXT,
    mother_name      TEXT,
    mother_phone     TEXT,
    mother_occupation TEXT,
    medical_history  TEXT,
    ncc              BOOLEAN DEFAULT FALSE,
    nss              BOOLEAN DEFAULT FALSE,
    sgfi             BOOLEAN DEFAULT FALSE,
    scouts           BOOLEAN DEFAULT FALSE,
    photo            TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 4. OBSERVATIONS
CREATE TABLE observations (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id       UUID REFERENCES students(id) ON DELETE CASCADE,
    school_id        UUID REFERENCES schools(id)  ON DELETE CASCADE,
    observation      TEXT NOT NULL,
    severity         TEXT DEFAULT 'Normal',
    observation_date DATE DEFAULT CURRENT_DATE,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 5. COUNSELLING RECORDS
CREATE TABLE counselling_records (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id  UUID REFERENCES students(id) ON DELETE CASCADE,
    school_id   UUID REFERENCES schools(id)  ON DELETE CASCADE,
    issue       TEXT NOT NULL,
    counselling TEXT NOT NULL,
    status      TEXT DEFAULT 'Resolved',
    follow_up   BOOLEAN DEFAULT FALSE,
    record_date DATE DEFAULT CURRENT_DATE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 6. MOVEMENTS
CREATE TABLE movements (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id   UUID REFERENCES students(id) ON DELETE CASCADE,
    school_id    UUID REFERENCES schools(id)  ON DELETE CASCADE,
    leave_date   DATE NOT NULL,
    report_date  DATE,
    reason       TEXT,
    escort_name  TEXT,
    relationship TEXT,
    phone        TEXT,
    return_escort_name TEXT,
    return_relationship TEXT,
    return_phone TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TEACHER DIARIES
CREATE TABLE teacher_diaries (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id        UUID REFERENCES schools(id) ON DELETE CASCADE,
    user_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    teacher_name     TEXT,
    diary_date       DATE DEFAULT CURRENT_DATE,
    period           TEXT,
    class            TEXT,
    section          TEXT,
    total_students   INTEGER DEFAULT 0,
    present          INTEGER DEFAULT 0,
    leave            INTEGER DEFAULT 0,
    on_duty          INTEGER DEFAULT 0,
    not_reported     INTEGER DEFAULT 0,
    topic_discussed  TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 8. REGISTRATION REQUESTS
CREATE TABLE registration_requests (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    udise       TEXT,
    school_name TEXT NOT NULL,
    admin_name  TEXT NOT NULL,
    email       TEXT NOT NULL,
    phone       TEXT,
    address     TEXT,
    status      TEXT DEFAULT 'pending',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 9. SUPPORT QUERIES
CREATE TABLE support_queries (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_name  TEXT,
    user_name    TEXT,
    email        TEXT,
    phone        TEXT,
    query        TEXT,
    status       TEXT DEFAULT 'pending',
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 10. PROFILES (extends Supabase Auth)
CREATE TABLE profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email       TEXT,
    name        TEXT,
    role        TEXT DEFAULT 'user',
    school_id   UUID REFERENCES schools(id) ON DELETE SET NULL,
    school_name TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- STEP 3: ENABLE Row Level Security (RLS)
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE counselling_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_diaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- STEP 4: CREATE RLS Policies

-- helper functions to restrict access to user's school_id
CREATE OR REPLACE FUNCTION get_user_school_id()
RETURNS UUID AS $$
  SELECT school_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT get_user_role() = 'admin' OR lower(auth.jwt() ->> 'email') = 'kotaramanakumari@gmail.com';
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Schools
CREATE POLICY "Schools access policy" ON schools
    FOR ALL TO authenticated
    USING (id = get_user_school_id() OR is_admin())
    WITH CHECK (id = get_user_school_id() OR is_admin());

-- Academic Years
CREATE POLICY "Academic years access policy" ON academic_years
    FOR ALL TO authenticated
    USING (school_id = get_user_school_id() OR is_admin())
    WITH CHECK (school_id = get_user_school_id() OR is_admin());

-- Students
CREATE POLICY "Students access policy" ON students
    FOR ALL TO authenticated
    USING (school_id = get_user_school_id() OR is_admin())
    WITH CHECK (school_id = get_user_school_id() OR is_admin());

-- Observations
CREATE POLICY "Observations access policy" ON observations
    FOR ALL TO authenticated
    USING (school_id = get_user_school_id() OR is_admin())
    WITH CHECK (school_id = get_user_school_id() OR is_admin());

-- Counselling
CREATE POLICY "Counselling records access policy" ON counselling_records
    FOR ALL TO authenticated
    USING (school_id = get_user_school_id() OR is_admin())
    WITH CHECK (school_id = get_user_school_id() OR is_admin());

-- Movements
CREATE POLICY "Movements access policy" ON movements
    FOR ALL TO authenticated
    USING (school_id = get_user_school_id() OR is_admin())
    WITH CHECK (school_id = get_user_school_id() OR is_admin());

-- Teacher Diaries
CREATE POLICY "Teacher diaries access policy" ON teacher_diaries
    FOR ALL TO authenticated
    USING (school_id = get_user_school_id() OR is_admin())
    WITH CHECK (school_id = get_user_school_id() OR is_admin());

-- Public Tables
CREATE POLICY "Allow all" ON registration_requests FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON support_queries FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);


-- Profiles Special Policies
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Super Admin can update all profiles" ON profiles
    FOR UPDATE TO authenticated
    USING (lower(auth.jwt() ->> 'email') = 'kotaramanakumari@gmail.com')
    WITH CHECK (lower(auth.jwt() ->> 'email') = 'kotaramanakumari@gmail.com');

CREATE POLICY "Super Admin can delete profiles" ON profiles
    FOR DELETE TO authenticated
    USING (lower(auth.jwt() ->> 'email') = 'kotaramanakumari@gmail.com');

CREATE POLICY "Allow read for all authenticated" ON profiles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow insert for everyone" ON profiles
    FOR INSERT TO public WITH CHECK (true);

-- STEP 5: Enable Realtime updates
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        BEGIN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', tbl);
        EXCEPTION WHEN OTHERS THEN
            -- Table might already be in publication, ignore and continue
        END;
    END LOOP;
END $$;
