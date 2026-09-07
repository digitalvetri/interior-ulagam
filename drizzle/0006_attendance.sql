-- 0006_attendance.sql — Attendance records + leave requests

-- Enums
CREATE TYPE "attendance_status" AS ENUM ('present', 'absent', 'leave', 'half_day', 'late', 'holiday');
CREATE TYPE "leave_type" AS ENUM ('casual', 'sick', 'earned', 'unpaid', 'maternity', 'paternity', 'comp_off');
CREATE TYPE "leave_status" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- attendance_records: one row per employee per day
CREATE TABLE "attendance_records" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"    uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id"      uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "date"         date NOT NULL,
  "status"       "attendance_status" NOT NULL DEFAULT 'present',
  "check_in_at"  timestamptz,
  "check_out_at" timestamptz,
  "notes"        text,
  "marked_by"    uuid REFERENCES "users"("id"),
  "created_at"   timestamptz NOT NULL DEFAULT now()
);

-- One record per employee per day — enforce at DB level
CREATE UNIQUE INDEX "attendance_user_date_uniq" ON "attendance_records"("user_id", "date");

CREATE INDEX "attendance_tenant_date_idx" ON "attendance_records"("tenant_id", "date");
CREATE INDEX "attendance_user_date_idx"   ON "attendance_records"("user_id", "date");

-- leave_requests: one request spans a date range
CREATE TABLE "leave_requests" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"    uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id"      uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "leave_type"   "leave_type" NOT NULL,
  "from_date"    date NOT NULL,
  "to_date"      date NOT NULL,
  "reason"       text NOT NULL,
  "status"       "leave_status" NOT NULL DEFAULT 'pending',
  "reviewed_by"  uuid REFERENCES "users"("id"),
  "reviewed_at"  timestamptz,
  "review_note"  text,
  "created_at"   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "leave_requests_tenant_idx" ON "leave_requests"("tenant_id");
CREATE INDEX "leave_requests_user_idx"   ON "leave_requests"("user_id");
CREATE INDEX "leave_requests_status_idx" ON "leave_requests"("status");
