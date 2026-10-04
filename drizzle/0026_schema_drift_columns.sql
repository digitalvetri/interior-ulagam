-- Columns declared in schema.ts that no migration ever created (found by
-- comparing every table in schema.ts with the live database). Without them,
-- logging an expense, numbering site logs/work orders and invoice notes fail.

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS vendor_name text;
--> statement-breakpoint
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS gst_pct integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS gst_amount_paise integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_number text;
--> statement-breakpoint
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
--> statement-breakpoint
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes text;
--> statement-breakpoint
ALTER TABLE site_logs ADD COLUMN IF NOT EXISTS log_number text;
--> statement-breakpoint
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS work_order_number text;
