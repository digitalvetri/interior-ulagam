-- Settings → Integrations: owner-entered AI / WhatsApp / Razorpay connections.
CREATE TABLE IF NOT EXISTS "integration_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "secrets_enc" text,
  "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "integration_settings_tenant_kind_idx" ON "integration_settings" ("tenant_id", "kind");
