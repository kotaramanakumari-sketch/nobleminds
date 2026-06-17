-- ==============================================================================
-- NOBLEMINDS — DATA MIGRATION SCRIPT
-- Run this in Supabase SQL Editor AFTER running setup_teacher_isolation.sql
-- ==============================================================================

-- 1. Update Observations
UPDATE observations o
SET user_id = p.id
FROM profiles p
WHERE o.school_id = p.school_id
  AND o.user_id IS NULL;

-- 2. Update Counselling Records
UPDATE counselling_records c
SET user_id = p.id
FROM profiles p
WHERE c.school_id = p.school_id
  AND c.user_id IS NULL;

-- 3. Update Movements
UPDATE movements m
SET user_id = p.id
FROM profiles p
WHERE m.school_id = p.school_id
  AND m.user_id IS NULL;

-- 4. Update Parent Interactions
UPDATE parent_interactions i
SET user_id = p.id
FROM profiles p
WHERE i.school_id = p.school_id
  AND i.user_id IS NULL;
