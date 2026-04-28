-- ============================================================
-- NobleMinds — ADD TEACHER DIARIES (SAFE MIGRATION)
-- Run this in Supabase SQL Editor to add the Teacher Diary 
-- feature without losing any existing data.
-- ============================================================

-- 1. Create the new Teacher Diaries table
CREATE TABLE IF NOT EXISTS teacher_diaries (
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

-- 2. Enable Row Level Security (RLS) on the new table
ALTER TABLE teacher_diaries ENABLE ROW LEVEL SECURITY;

-- 3. Add RLS Policy (Allow authenticated users access)
-- Note: Doing this IF NOT EXISTS is trickier in PG, so we try to drop it first just in case
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow all for authenticated" ON teacher_diaries;
    CREATE POLICY "Allow all for authenticated" ON teacher_diaries
        FOR ALL TO authenticated USING (true) WITH CHECK (true);
END $$;

-- 4. Enable Realtime updates for the new table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'teacher_diaries'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE teacher_diaries;
    END IF;
END $$;
