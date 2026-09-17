-- Add vendor_id FK to expenses table
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL;
