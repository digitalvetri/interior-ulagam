-- 0007_checkin_location.sql — Add GPS location fields to attendance_records for employee self check-in

ALTER TABLE "attendance_records"
  ADD COLUMN IF NOT EXISTS "check_in_latitude"  numeric(10, 7),
  ADD COLUMN IF NOT EXISTS "check_in_longitude" numeric(10, 7),
  ADD COLUMN IF NOT EXISTS "check_in_address"   text;
