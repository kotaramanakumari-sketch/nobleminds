-- ============================================================
-- NobleMinds — CLEANUP & MIGRATION: 2023-2024 -> 2026-2027
-- This script moves all data to the new default year and removes the old one.
-- ============================================================

DO $$
DECLARE
    y23 UUID;
    y26 UUID;
    school_rec RECORD;
BEGIN
    FOR school_rec IN SELECT id FROM schools LOOP
        -- 1. Identify or Create the 2026-2027 year
        SELECT id INTO y26 FROM academic_years WHERE school_id = school_rec.id AND name = '2026-2027';
        
        IF y26 IS NULL THEN
            INSERT INTO academic_years (school_id, name, is_active)
            VALUES (school_rec.id, '2026-2027', TRUE)
            RETURNING id INTO y26;
        ELSE
            -- Ensure it is active
            UPDATE academic_years SET is_active = TRUE WHERE id = y26;
            UPDATE academic_years SET is_active = FALSE WHERE school_id = school_rec.id AND id <> y26;
        END IF;

        -- 2. Identify the 2023-2024 year
        SELECT id INTO y23 FROM academic_years WHERE school_id = school_rec.id AND name = '2023-2024';

        -- 3. If found, migrate students linked to it
        IF y23 IS NOT NULL THEN
            UPDATE students SET academic_year_id = y26 WHERE academic_year_id = y23;
            
            -- Also catch any students that might be linked to NO year for some reason
            UPDATE students SET academic_year_id = y26 WHERE school_id = school_rec.id AND academic_year_id IS NULL;

            -- 4. Delete the old year record
            DELETE FROM academic_years WHERE id = y23;
        END IF;
        
        -- Final sweep: Ensure ALL students in this school are linked to 2026-2027 if they have no year
        UPDATE students SET academic_year_id = y26 WHERE school_id = school_rec.id AND academic_year_id IS NULL;
        
    END LOOP;
END $$;
