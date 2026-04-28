-- ============================================================
-- NobleMinds — MIGRATION: ACADEMIC YEARS
-- Add this to your Supabase SQL Editor to upgrade existing tables.
-- ============================================================

-- 1. Create academic_years table
CREATE TABLE IF NOT EXISTS academic_years (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id    UUID REFERENCES schools(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    is_active    BOOLEAN DEFAULT FALSE,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add academic_year_id to students
ALTER TABLE students ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL;

-- 3. Migration logic for existing data
-- For each school that has students, create a default initial year.
DO $$
DECLARE
    school_record RECORD;
    year_id UUID;
BEGIN
    FOR school_record IN SELECT id FROM schools LOOP
        -- Create a default year for this school if no year exists
        IF NOT EXISTS (SELECT 1 FROM academic_years WHERE school_id = school_record.id) THEN
            INSERT INTO academic_years (school_id, name, is_active)
            VALUES (school_record.id, '2026-2027', TRUE)
            RETURNING id INTO year_id;
            
            -- Link all existing students from this school to this new academic year
            UPDATE students SET academic_year_id = year_id WHERE school_id = school_record.id AND academic_year_id IS NULL;
        END IF;
    END LOOP;
END $$;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policy
DROP POLICY IF EXISTS "Allow all for authenticated" ON academic_years;
CREATE POLICY "Allow all for authenticated" ON academic_years
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Realtime
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'academic_years'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE academic_years;
    END IF;
END $$;
