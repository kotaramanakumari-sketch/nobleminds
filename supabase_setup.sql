-- ============================================================
-- NobleMinds — FULL RESET & SETUP SQL
-- Run this ONCE in Supabase SQL Editor to start fresh.
-- ============================================================

-- STEP 1: DROP all existing tables (must be in child-first order)
DROP TABLE IF EXISTS movements             CASCADE;
DROP TABLE IF EXISTS counselling_records   CASCADE;
DROP TABLE IF EXISTS observations          CASCADE;
DROP TABLE IF EXISTS registration_requests CASCADE;
DROP TABLE IF EXISTS profiles              CASCADE;
DROP TABLE IF EXISTS students              CASCADE;
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

-- 2. STUDENTS
CREATE TABLE students (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id        UUID REFERENCES schools(id) ON DELETE CASCADE,
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

-- 3. OBSERVATIONS
CREATE TABLE observations (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id       UUID REFERENCES students(id) ON DELETE CASCADE,
    school_id        UUID REFERENCES schools(id)  ON DELETE CASCADE,
    observation      TEXT NOT NULL,
    severity         TEXT DEFAULT 'Normal',
    observation_date DATE DEFAULT CURRENT_DATE,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 4. COUNSELLING RECORDS
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

-- 5. MOVEMENTS
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
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 6. REGISTRATION REQUESTS
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

-- 7. PROFILES (extends Supabase Auth)
CREATE TABLE profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name        TEXT,
    role        TEXT DEFAULT 'user',
    school_id   UUID REFERENCES schools(id) ON DELETE SET NULL,
    school_name TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STEP 3: Enable Row Level Security (RLS) on all tables
-- ============================================================
ALTER TABLE schools               ENABLE ROW LEVEL SECURITY;
ALTER TABLE students              ENABLE ROW LEVEL SECURITY;
ALTER TABLE observations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE counselling_records   ENABLE ROW LEVEL SECURITY;
ALTER TABLE movements             ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 4: RLS Policies — allow authenticated users full access
-- (The app handles its own role-based access control)
-- ============================================================

-- SCHOOLS
CREATE POLICY "Allow all for authenticated" ON schools
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read schools" ON schools
    FOR SELECT TO anon USING (true);

-- STUDENTS
CREATE POLICY "Allow all for authenticated" ON students
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- OBSERVATIONS
CREATE POLICY "Allow all for authenticated" ON observations
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- COUNSELLING
CREATE POLICY "Allow all for authenticated" ON counselling_records
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- MOVEMENTS
CREATE POLICY "Allow all for authenticated" ON movements
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- REGISTRATION REQUESTS
CREATE POLICY "Allow all" ON registration_requests
    FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- PROFILES
CREATE POLICY "Users can read own profile" ON profiles
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE TO authenticated USING (auth.uid() = id);

-- ============================================================
-- STEP 5: Realtime (safe — only adds if not already a member)
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'students'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE students;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'observations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE observations;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'counselling_records'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE counselling_records;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'movements'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE movements;
    END IF;
END $$;
