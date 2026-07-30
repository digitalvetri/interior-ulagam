-- Allow quotes to exist without a project (pre-sale estimates linked to a lead)
ALTER TABLE "public"."quotes" ALTER COLUMN "project_id" DROP NOT NULL;

-- Link quotes to a lead directly
ALTER TABLE "public"."quotes" ADD COLUMN IF NOT EXISTS "lead_id" uuid REFERENCES "public"."leads"("id") ON DELETE SET NULL;

-- Link documents to a lead directly
ALTER TABLE "public"."documents" ADD COLUMN IF NOT EXISTS "lead_id" uuid REFERENCES "public"."leads"("id") ON DELETE SET NULL;
