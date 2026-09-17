-- Consolidate duplicate indexes on attendance_records(user_id, date).
-- The unique constraint already existed as attendance_user_date_uniq; drop both
-- old indexes and re-create a single uniqueIndex matching the Drizzle schema name.
DROP INDEX IF EXISTS attendance_user_date_idx;
DROP INDEX IF EXISTS attendance_user_date_uniq;
CREATE UNIQUE INDEX attendance_user_date_idx ON attendance_records(user_id, date);
