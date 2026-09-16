-- Add no_show to site_visit_status enum
ALTER TYPE site_visit_status ADD VALUE IF NOT EXISTS 'no_show';
