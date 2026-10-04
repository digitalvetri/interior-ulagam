-- Staff given a temporary password (new login or owner reset) must set their own before using the app.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "must_change_password" boolean DEFAULT false NOT NULL;
