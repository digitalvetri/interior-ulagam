-- Attendance: GPS accuracy at check-in, and the full location at check-out.
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "check_in_accuracy_m" integer;
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "check_out_latitude" numeric(10, 7);
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "check_out_longitude" numeric(10, 7);
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "check_out_address" text;
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "check_out_accuracy_m" integer;
