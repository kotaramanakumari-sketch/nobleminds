-- ==============================================================================
-- NOBLEMINDS — RLS POLICY FIX SCRIPT
-- Run this in Supabase SQL Editor
-- ==============================================================================

-- 1. Drop the old "School Isolation Policy" which was allowing all teachers to see everything in the school
DROP POLICY IF EXISTS "School Isolation Policy" ON observations;
DROP POLICY IF EXISTS "School Isolation Policy" ON counselling_records;
DROP POLICY IF EXISTS "School Isolation Policy" ON parent_interactions;
DROP POLICY IF EXISTS "School Isolation Policy" ON movements;

-- (The new "Teacher owns..." policies you created earlier are already active and will now take over securely.)
