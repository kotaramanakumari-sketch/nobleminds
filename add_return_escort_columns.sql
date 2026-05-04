-- ============================================================
-- NobleMinds — ADD RETURN ESCORT COLUMNS TO MOVEMENTS
-- ============================================================

ALTER TABLE movements 
ADD COLUMN IF NOT EXISTS return_escort_name TEXT,
ADD COLUMN IF NOT EXISTS return_relationship TEXT,
ADD COLUMN IF NOT EXISTS return_phone TEXT;
