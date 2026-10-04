-- Fresh-database completeness: makes any database match src/lib/db/schema.ts.
-- Generated from the schema (drizzle-kit generate against an empty snapshot) and
-- rewritten to be idempotent: types, tables, columns, foreign keys and indexes
-- are only created when missing. Existing databases are left as they are; a
-- fresh production database gets everything that earlier migrations never
-- created (vendor_payments, ai_actions, work_order_updates, site visit/log,
-- measurement, quote and work-order columns).
DO $$ BEGIN CREATE TYPE "public"."attendance_status" AS ENUM('present', 'absent', 'leave', 'half_day', 'late', 'holiday'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."attendance_status" ADD VALUE IF NOT EXISTS 'present';
--> statement-breakpoint
ALTER TYPE "public"."attendance_status" ADD VALUE IF NOT EXISTS 'absent';
--> statement-breakpoint
ALTER TYPE "public"."attendance_status" ADD VALUE IF NOT EXISTS 'leave';
--> statement-breakpoint
ALTER TYPE "public"."attendance_status" ADD VALUE IF NOT EXISTS 'half_day';
--> statement-breakpoint
ALTER TYPE "public"."attendance_status" ADD VALUE IF NOT EXISTS 'late';
--> statement-breakpoint
ALTER TYPE "public"."attendance_status" ADD VALUE IF NOT EXISTS 'holiday';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."civil_job_status" AS ENUM('done', 'billed', 'paid'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."civil_job_status" ADD VALUE IF NOT EXISTS 'done';
--> statement-breakpoint
ALTER TYPE "public"."civil_job_status" ADD VALUE IF NOT EXISTS 'billed';
--> statement-breakpoint
ALTER TYPE "public"."civil_job_status" ADD VALUE IF NOT EXISTS 'paid';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."civil_line_kind" AS ENUM('material', 'labour'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."civil_line_kind" ADD VALUE IF NOT EXISTS 'material';
--> statement-breakpoint
ALTER TYPE "public"."civil_line_kind" ADD VALUE IF NOT EXISTS 'labour';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."customer_activity_type" AS ENUM('call', 'whatsapp', 'note', 'site_visit', 'meeting', 'stage_change', 'project_created', 'payment_received', 'quote_sent', 'follow_up'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."customer_activity_type" ADD VALUE IF NOT EXISTS 'call';
--> statement-breakpoint
ALTER TYPE "public"."customer_activity_type" ADD VALUE IF NOT EXISTS 'whatsapp';
--> statement-breakpoint
ALTER TYPE "public"."customer_activity_type" ADD VALUE IF NOT EXISTS 'note';
--> statement-breakpoint
ALTER TYPE "public"."customer_activity_type" ADD VALUE IF NOT EXISTS 'site_visit';
--> statement-breakpoint
ALTER TYPE "public"."customer_activity_type" ADD VALUE IF NOT EXISTS 'meeting';
--> statement-breakpoint
ALTER TYPE "public"."customer_activity_type" ADD VALUE IF NOT EXISTS 'stage_change';
--> statement-breakpoint
ALTER TYPE "public"."customer_activity_type" ADD VALUE IF NOT EXISTS 'project_created';
--> statement-breakpoint
ALTER TYPE "public"."customer_activity_type" ADD VALUE IF NOT EXISTS 'payment_received';
--> statement-breakpoint
ALTER TYPE "public"."customer_activity_type" ADD VALUE IF NOT EXISTS 'quote_sent';
--> statement-breakpoint
ALTER TYPE "public"."customer_activity_type" ADD VALUE IF NOT EXISTS 'follow_up';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."customer_health_status" AS ENUM('hot', 'healthy', 'at_risk', 'inactive'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."customer_health_status" ADD VALUE IF NOT EXISTS 'hot';
--> statement-breakpoint
ALTER TYPE "public"."customer_health_status" ADD VALUE IF NOT EXISTS 'healthy';
--> statement-breakpoint
ALTER TYPE "public"."customer_health_status" ADD VALUE IF NOT EXISTS 'at_risk';
--> statement-breakpoint
ALTER TYPE "public"."customer_health_status" ADD VALUE IF NOT EXISTS 'inactive';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."customer_source" AS ENUM('referral', 'instagram', 'whatsapp', 'website', 'walk_in', 'imported', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."customer_source" ADD VALUE IF NOT EXISTS 'referral';
--> statement-breakpoint
ALTER TYPE "public"."customer_source" ADD VALUE IF NOT EXISTS 'instagram';
--> statement-breakpoint
ALTER TYPE "public"."customer_source" ADD VALUE IF NOT EXISTS 'whatsapp';
--> statement-breakpoint
ALTER TYPE "public"."customer_source" ADD VALUE IF NOT EXISTS 'website';
--> statement-breakpoint
ALTER TYPE "public"."customer_source" ADD VALUE IF NOT EXISTS 'walk_in';
--> statement-breakpoint
ALTER TYPE "public"."customer_source" ADD VALUE IF NOT EXISTS 'imported';
--> statement-breakpoint
ALTER TYPE "public"."customer_source" ADD VALUE IF NOT EXISTS 'other';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."customer_stage" AS ENUM('lead', 'opportunity', 'client', 'past_client'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."customer_stage" ADD VALUE IF NOT EXISTS 'lead';
--> statement-breakpoint
ALTER TYPE "public"."customer_stage" ADD VALUE IF NOT EXISTS 'opportunity';
--> statement-breakpoint
ALTER TYPE "public"."customer_stage" ADD VALUE IF NOT EXISTS 'client';
--> statement-breakpoint
ALTER TYPE "public"."customer_stage" ADD VALUE IF NOT EXISTS 'past_client';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."deliverable_status" AS ENUM('pending', 'in_progress', 'in_review', 'approved', 'rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."deliverable_status" ADD VALUE IF NOT EXISTS 'pending';
--> statement-breakpoint
ALTER TYPE "public"."deliverable_status" ADD VALUE IF NOT EXISTS 'in_progress';
--> statement-breakpoint
ALTER TYPE "public"."deliverable_status" ADD VALUE IF NOT EXISTS 'in_review';
--> statement-breakpoint
ALTER TYPE "public"."deliverable_status" ADD VALUE IF NOT EXISTS 'approved';
--> statement-breakpoint
ALTER TYPE "public"."deliverable_status" ADD VALUE IF NOT EXISTS 'rejected';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."deliverable_type" AS ENUM('2d_plan', '3d_render', 'color_palette', 'working_drawings', 'bom'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."deliverable_type" ADD VALUE IF NOT EXISTS '2d_plan';
--> statement-breakpoint
ALTER TYPE "public"."deliverable_type" ADD VALUE IF NOT EXISTS '3d_render';
--> statement-breakpoint
ALTER TYPE "public"."deliverable_type" ADD VALUE IF NOT EXISTS 'color_palette';
--> statement-breakpoint
ALTER TYPE "public"."deliverable_type" ADD VALUE IF NOT EXISTS 'working_drawings';
--> statement-breakpoint
ALTER TYPE "public"."deliverable_type" ADD VALUE IF NOT EXISTS 'bom';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."design_deliverable_status" AS ENUM('draft', 'shared', 'changes_requested', 'approved'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."design_deliverable_status" ADD VALUE IF NOT EXISTS 'draft';
--> statement-breakpoint
ALTER TYPE "public"."design_deliverable_status" ADD VALUE IF NOT EXISTS 'shared';
--> statement-breakpoint
ALTER TYPE "public"."design_deliverable_status" ADD VALUE IF NOT EXISTS 'changes_requested';
--> statement-breakpoint
ALTER TYPE "public"."design_deliverable_status" ADD VALUE IF NOT EXISTS 'approved';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."design_deliverable_type" AS ENUM('mood_board', '2d_layout', '3d_render', 'working_drawing', 'material_board'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."design_deliverable_type" ADD VALUE IF NOT EXISTS 'mood_board';
--> statement-breakpoint
ALTER TYPE "public"."design_deliverable_type" ADD VALUE IF NOT EXISTS '2d_layout';
--> statement-breakpoint
ALTER TYPE "public"."design_deliverable_type" ADD VALUE IF NOT EXISTS '3d_render';
--> statement-breakpoint
ALTER TYPE "public"."design_deliverable_type" ADD VALUE IF NOT EXISTS 'working_drawing';
--> statement-breakpoint
ALTER TYPE "public"."design_deliverable_type" ADD VALUE IF NOT EXISTS 'material_board';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."design_task_priority" AS ENUM('low', 'normal', 'high', 'urgent'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."design_task_priority" ADD VALUE IF NOT EXISTS 'low';
--> statement-breakpoint
ALTER TYPE "public"."design_task_priority" ADD VALUE IF NOT EXISTS 'normal';
--> statement-breakpoint
ALTER TYPE "public"."design_task_priority" ADD VALUE IF NOT EXISTS 'high';
--> statement-breakpoint
ALTER TYPE "public"."design_task_priority" ADD VALUE IF NOT EXISTS 'urgent';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."design_task_status" AS ENUM('todo', 'in_progress', 'review', 'done'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."design_task_status" ADD VALUE IF NOT EXISTS 'todo';
--> statement-breakpoint
ALTER TYPE "public"."design_task_status" ADD VALUE IF NOT EXISTS 'in_progress';
--> statement-breakpoint
ALTER TYPE "public"."design_task_status" ADD VALUE IF NOT EXISTS 'review';
--> statement-breakpoint
ALTER TYPE "public"."design_task_status" ADD VALUE IF NOT EXISTS 'done';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."document_kind" AS ENUM('folder', 'file'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."document_kind" ADD VALUE IF NOT EXISTS 'folder';
--> statement-breakpoint
ALTER TYPE "public"."document_kind" ADD VALUE IF NOT EXISTS 'file';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."employment_type" AS ENUM('full_time', 'part_time', 'contract', 'intern', 'consultant'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."employment_type" ADD VALUE IF NOT EXISTS 'full_time';
--> statement-breakpoint
ALTER TYPE "public"."employment_type" ADD VALUE IF NOT EXISTS 'part_time';
--> statement-breakpoint
ALTER TYPE "public"."employment_type" ADD VALUE IF NOT EXISTS 'contract';
--> statement-breakpoint
ALTER TYPE "public"."employment_type" ADD VALUE IF NOT EXISTS 'intern';
--> statement-breakpoint
ALTER TYPE "public"."employment_type" ADD VALUE IF NOT EXISTS 'consultant';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."expense_category" AS ENUM('petty_cash', 'transport', 'labour', 'material', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."expense_category" ADD VALUE IF NOT EXISTS 'petty_cash';
--> statement-breakpoint
ALTER TYPE "public"."expense_category" ADD VALUE IF NOT EXISTS 'transport';
--> statement-breakpoint
ALTER TYPE "public"."expense_category" ADD VALUE IF NOT EXISTS 'labour';
--> statement-breakpoint
ALTER TYPE "public"."expense_category" ADD VALUE IF NOT EXISTS 'material';
--> statement-breakpoint
ALTER TYPE "public"."expense_category" ADD VALUE IF NOT EXISTS 'other';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."follow_up_status" AS ENUM('pending', 'completed', 'overdue', 'rescheduled', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."follow_up_status" ADD VALUE IF NOT EXISTS 'pending';
--> statement-breakpoint
ALTER TYPE "public"."follow_up_status" ADD VALUE IF NOT EXISTS 'completed';
--> statement-breakpoint
ALTER TYPE "public"."follow_up_status" ADD VALUE IF NOT EXISTS 'overdue';
--> statement-breakpoint
ALTER TYPE "public"."follow_up_status" ADD VALUE IF NOT EXISTS 'rescheduled';
--> statement-breakpoint
ALTER TYPE "public"."follow_up_status" ADD VALUE IF NOT EXISTS 'cancelled';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."follow_up_type" AS ENUM('call', 'whatsapp', 'meeting', 'email'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."follow_up_type" ADD VALUE IF NOT EXISTS 'call';
--> statement-breakpoint
ALTER TYPE "public"."follow_up_type" ADD VALUE IF NOT EXISTS 'whatsapp';
--> statement-breakpoint
ALTER TYPE "public"."follow_up_type" ADD VALUE IF NOT EXISTS 'meeting';
--> statement-breakpoint
ALTER TYPE "public"."follow_up_type" ADD VALUE IF NOT EXISTS 'email';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."invoice_lifecycle_status" AS ENUM('draft', 'issued', 'part_paid', 'paid', 'void'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."invoice_lifecycle_status" ADD VALUE IF NOT EXISTS 'draft';
--> statement-breakpoint
ALTER TYPE "public"."invoice_lifecycle_status" ADD VALUE IF NOT EXISTS 'issued';
--> statement-breakpoint
ALTER TYPE "public"."invoice_lifecycle_status" ADD VALUE IF NOT EXISTS 'part_paid';
--> statement-breakpoint
ALTER TYPE "public"."invoice_lifecycle_status" ADD VALUE IF NOT EXISTS 'paid';
--> statement-breakpoint
ALTER TYPE "public"."invoice_lifecycle_status" ADD VALUE IF NOT EXISTS 'void';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."lead_activity_type" AS ENUM('call', 'whatsapp', 'note', 'site_visit', 'meeting', 'stage_change', 'follow_up', 'task'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."lead_activity_type" ADD VALUE IF NOT EXISTS 'call';
--> statement-breakpoint
ALTER TYPE "public"."lead_activity_type" ADD VALUE IF NOT EXISTS 'whatsapp';
--> statement-breakpoint
ALTER TYPE "public"."lead_activity_type" ADD VALUE IF NOT EXISTS 'note';
--> statement-breakpoint
ALTER TYPE "public"."lead_activity_type" ADD VALUE IF NOT EXISTS 'site_visit';
--> statement-breakpoint
ALTER TYPE "public"."lead_activity_type" ADD VALUE IF NOT EXISTS 'meeting';
--> statement-breakpoint
ALTER TYPE "public"."lead_activity_type" ADD VALUE IF NOT EXISTS 'stage_change';
--> statement-breakpoint
ALTER TYPE "public"."lead_activity_type" ADD VALUE IF NOT EXISTS 'follow_up';
--> statement-breakpoint
ALTER TYPE "public"."lead_activity_type" ADD VALUE IF NOT EXISTS 'task';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."lead_priority" AS ENUM('hot', 'warm', 'cold'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."lead_priority" ADD VALUE IF NOT EXISTS 'hot';
--> statement-breakpoint
ALTER TYPE "public"."lead_priority" ADD VALUE IF NOT EXISTS 'warm';
--> statement-breakpoint
ALTER TYPE "public"."lead_priority" ADD VALUE IF NOT EXISTS 'cold';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."lead_source" AS ENUM('instagram', 'whatsapp', 'referral', 'website', 'walk_in', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."lead_source" ADD VALUE IF NOT EXISTS 'instagram';
--> statement-breakpoint
ALTER TYPE "public"."lead_source" ADD VALUE IF NOT EXISTS 'whatsapp';
--> statement-breakpoint
ALTER TYPE "public"."lead_source" ADD VALUE IF NOT EXISTS 'referral';
--> statement-breakpoint
ALTER TYPE "public"."lead_source" ADD VALUE IF NOT EXISTS 'website';
--> statement-breakpoint
ALTER TYPE "public"."lead_source" ADD VALUE IF NOT EXISTS 'walk_in';
--> statement-breakpoint
ALTER TYPE "public"."lead_source" ADD VALUE IF NOT EXISTS 'other';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."lead_stage" AS ENUM('new', 'contacted', 'qualified', 'site_visit', 'measurement', 'quotation', 'negotiation', 'won', 'lost', 'site_visit_scheduled', 'consultation_done', 'proposal_sent', 'measured', 'booked'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."lead_stage" ADD VALUE IF NOT EXISTS 'new';
--> statement-breakpoint
ALTER TYPE "public"."lead_stage" ADD VALUE IF NOT EXISTS 'contacted';
--> statement-breakpoint
ALTER TYPE "public"."lead_stage" ADD VALUE IF NOT EXISTS 'qualified';
--> statement-breakpoint
ALTER TYPE "public"."lead_stage" ADD VALUE IF NOT EXISTS 'site_visit';
--> statement-breakpoint
ALTER TYPE "public"."lead_stage" ADD VALUE IF NOT EXISTS 'measurement';
--> statement-breakpoint
ALTER TYPE "public"."lead_stage" ADD VALUE IF NOT EXISTS 'quotation';
--> statement-breakpoint
ALTER TYPE "public"."lead_stage" ADD VALUE IF NOT EXISTS 'negotiation';
--> statement-breakpoint
ALTER TYPE "public"."lead_stage" ADD VALUE IF NOT EXISTS 'won';
--> statement-breakpoint
ALTER TYPE "public"."lead_stage" ADD VALUE IF NOT EXISTS 'lost';
--> statement-breakpoint
ALTER TYPE "public"."lead_stage" ADD VALUE IF NOT EXISTS 'site_visit_scheduled';
--> statement-breakpoint
ALTER TYPE "public"."lead_stage" ADD VALUE IF NOT EXISTS 'consultation_done';
--> statement-breakpoint
ALTER TYPE "public"."lead_stage" ADD VALUE IF NOT EXISTS 'proposal_sent';
--> statement-breakpoint
ALTER TYPE "public"."lead_stage" ADD VALUE IF NOT EXISTS 'measured';
--> statement-breakpoint
ALTER TYPE "public"."lead_stage" ADD VALUE IF NOT EXISTS 'booked';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."leave_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."leave_status" ADD VALUE IF NOT EXISTS 'pending';
--> statement-breakpoint
ALTER TYPE "public"."leave_status" ADD VALUE IF NOT EXISTS 'approved';
--> statement-breakpoint
ALTER TYPE "public"."leave_status" ADD VALUE IF NOT EXISTS 'rejected';
--> statement-breakpoint
ALTER TYPE "public"."leave_status" ADD VALUE IF NOT EXISTS 'cancelled';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."leave_type" AS ENUM('casual', 'sick', 'earned', 'unpaid', 'maternity', 'paternity', 'comp_off'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."leave_type" ADD VALUE IF NOT EXISTS 'casual';
--> statement-breakpoint
ALTER TYPE "public"."leave_type" ADD VALUE IF NOT EXISTS 'sick';
--> statement-breakpoint
ALTER TYPE "public"."leave_type" ADD VALUE IF NOT EXISTS 'earned';
--> statement-breakpoint
ALTER TYPE "public"."leave_type" ADD VALUE IF NOT EXISTS 'unpaid';
--> statement-breakpoint
ALTER TYPE "public"."leave_type" ADD VALUE IF NOT EXISTS 'maternity';
--> statement-breakpoint
ALTER TYPE "public"."leave_type" ADD VALUE IF NOT EXISTS 'paternity';
--> statement-breakpoint
ALTER TYPE "public"."leave_type" ADD VALUE IF NOT EXISTS 'comp_off';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."ledger_adjustment_kind" AS ENUM('discount', 'refund', 'write_off'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."ledger_adjustment_kind" ADD VALUE IF NOT EXISTS 'discount';
--> statement-breakpoint
ALTER TYPE "public"."ledger_adjustment_kind" ADD VALUE IF NOT EXISTS 'refund';
--> statement-breakpoint
ALTER TYPE "public"."ledger_adjustment_kind" ADD VALUE IF NOT EXISTS 'write_off';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."material_category" AS ENUM('laminate', 'hardware', 'furniture', 'fabric', 'lighting', 'flooring', 'sanitary', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."material_category" ADD VALUE IF NOT EXISTS 'laminate';
--> statement-breakpoint
ALTER TYPE "public"."material_category" ADD VALUE IF NOT EXISTS 'hardware';
--> statement-breakpoint
ALTER TYPE "public"."material_category" ADD VALUE IF NOT EXISTS 'furniture';
--> statement-breakpoint
ALTER TYPE "public"."material_category" ADD VALUE IF NOT EXISTS 'fabric';
--> statement-breakpoint
ALTER TYPE "public"."material_category" ADD VALUE IF NOT EXISTS 'lighting';
--> statement-breakpoint
ALTER TYPE "public"."material_category" ADD VALUE IF NOT EXISTS 'flooring';
--> statement-breakpoint
ALTER TYPE "public"."material_category" ADD VALUE IF NOT EXISTS 'sanitary';
--> statement-breakpoint
ALTER TYPE "public"."material_category" ADD VALUE IF NOT EXISTS 'other';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."measurement_round_status" AS ENUM('draft', 'completed', 'revised'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."measurement_round_status" ADD VALUE IF NOT EXISTS 'draft';
--> statement-breakpoint
ALTER TYPE "public"."measurement_round_status" ADD VALUE IF NOT EXISTS 'completed';
--> statement-breakpoint
ALTER TYPE "public"."measurement_round_status" ADD VALUE IF NOT EXISTS 'revised';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."message_category" AS ENUM('utility', 'marketing', 'service'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."message_category" ADD VALUE IF NOT EXISTS 'utility';
--> statement-breakpoint
ALTER TYPE "public"."message_category" ADD VALUE IF NOT EXISTS 'marketing';
--> statement-breakpoint
ALTER TYPE "public"."message_category" ADD VALUE IF NOT EXISTS 'service';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."message_direction" AS ENUM('inbound', 'outbound'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."message_direction" ADD VALUE IF NOT EXISTS 'inbound';
--> statement-breakpoint
ALTER TYPE "public"."message_direction" ADD VALUE IF NOT EXISTS 'outbound';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."notification_severity" AS ENUM('info', 'success', 'warning', 'critical'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."notification_severity" ADD VALUE IF NOT EXISTS 'info';
--> statement-breakpoint
ALTER TYPE "public"."notification_severity" ADD VALUE IF NOT EXISTS 'success';
--> statement-breakpoint
ALTER TYPE "public"."notification_severity" ADD VALUE IF NOT EXISTS 'warning';
--> statement-breakpoint
ALTER TYPE "public"."notification_severity" ADD VALUE IF NOT EXISTS 'critical';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."payee_type" AS ENUM('vendor', 'staff', 'office', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."payee_type" ADD VALUE IF NOT EXISTS 'vendor';
--> statement-breakpoint
ALTER TYPE "public"."payee_type" ADD VALUE IF NOT EXISTS 'staff';
--> statement-breakpoint
ALTER TYPE "public"."payee_type" ADD VALUE IF NOT EXISTS 'office';
--> statement-breakpoint
ALTER TYPE "public"."payee_type" ADD VALUE IF NOT EXISTS 'other';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."payment_mode" AS ENUM('upi', 'cash', 'bank', 'cheque', 'card', 'razorpay'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."payment_mode" ADD VALUE IF NOT EXISTS 'upi';
--> statement-breakpoint
ALTER TYPE "public"."payment_mode" ADD VALUE IF NOT EXISTS 'cash';
--> statement-breakpoint
ALTER TYPE "public"."payment_mode" ADD VALUE IF NOT EXISTS 'bank';
--> statement-breakpoint
ALTER TYPE "public"."payment_mode" ADD VALUE IF NOT EXISTS 'cheque';
--> statement-breakpoint
ALTER TYPE "public"."payment_mode" ADD VALUE IF NOT EXISTS 'card';
--> statement-breakpoint
ALTER TYPE "public"."payment_mode" ADD VALUE IF NOT EXISTS 'razorpay';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."payment_status" AS ENUM('pending', 'link_sent', 'paid', 'overdue'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."payment_status" ADD VALUE IF NOT EXISTS 'pending';
--> statement-breakpoint
ALTER TYPE "public"."payment_status" ADD VALUE IF NOT EXISTS 'link_sent';
--> statement-breakpoint
ALTER TYPE "public"."payment_status" ADD VALUE IF NOT EXISTS 'paid';
--> statement-breakpoint
ALTER TYPE "public"."payment_status" ADD VALUE IF NOT EXISTS 'overdue';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."payroll_run_status" AS ENUM('draft', 'approved', 'paid'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."payroll_run_status" ADD VALUE IF NOT EXISTS 'draft';
--> statement-breakpoint
ALTER TYPE "public"."payroll_run_status" ADD VALUE IF NOT EXISTS 'approved';
--> statement-breakpoint
ALTER TYPE "public"."payroll_run_status" ADD VALUE IF NOT EXISTS 'paid';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."po_status" AS ENUM('draft', 'sent', 'acknowledged', 'partial', 'complete', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."po_status" ADD VALUE IF NOT EXISTS 'draft';
--> statement-breakpoint
ALTER TYPE "public"."po_status" ADD VALUE IF NOT EXISTS 'sent';
--> statement-breakpoint
ALTER TYPE "public"."po_status" ADD VALUE IF NOT EXISTS 'acknowledged';
--> statement-breakpoint
ALTER TYPE "public"."po_status" ADD VALUE IF NOT EXISTS 'partial';
--> statement-breakpoint
ALTER TYPE "public"."po_status" ADD VALUE IF NOT EXISTS 'complete';
--> statement-breakpoint
ALTER TYPE "public"."po_status" ADD VALUE IF NOT EXISTS 'cancelled';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."project_stage" AS ENUM('design_pending', 'design_in_progress', 'design_approved', 'procurement', 'execution', 'snagging', 'handover', 'complete'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."project_stage" ADD VALUE IF NOT EXISTS 'design_pending';
--> statement-breakpoint
ALTER TYPE "public"."project_stage" ADD VALUE IF NOT EXISTS 'design_in_progress';
--> statement-breakpoint
ALTER TYPE "public"."project_stage" ADD VALUE IF NOT EXISTS 'design_approved';
--> statement-breakpoint
ALTER TYPE "public"."project_stage" ADD VALUE IF NOT EXISTS 'procurement';
--> statement-breakpoint
ALTER TYPE "public"."project_stage" ADD VALUE IF NOT EXISTS 'execution';
--> statement-breakpoint
ALTER TYPE "public"."project_stage" ADD VALUE IF NOT EXISTS 'snagging';
--> statement-breakpoint
ALTER TYPE "public"."project_stage" ADD VALUE IF NOT EXISTS 'handover';
--> statement-breakpoint
ALTER TYPE "public"."project_stage" ADD VALUE IF NOT EXISTS 'complete';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."quote_status" AS ENUM('draft', 'sent', 'revised', 'accepted', 'rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."quote_status" ADD VALUE IF NOT EXISTS 'draft';
--> statement-breakpoint
ALTER TYPE "public"."quote_status" ADD VALUE IF NOT EXISTS 'sent';
--> statement-breakpoint
ALTER TYPE "public"."quote_status" ADD VALUE IF NOT EXISTS 'revised';
--> statement-breakpoint
ALTER TYPE "public"."quote_status" ADD VALUE IF NOT EXISTS 'accepted';
--> statement-breakpoint
ALTER TYPE "public"."quote_status" ADD VALUE IF NOT EXISTS 'rejected';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."service_request_priority" AS ENUM('low', 'medium', 'high', 'urgent'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."service_request_priority" ADD VALUE IF NOT EXISTS 'low';
--> statement-breakpoint
ALTER TYPE "public"."service_request_priority" ADD VALUE IF NOT EXISTS 'medium';
--> statement-breakpoint
ALTER TYPE "public"."service_request_priority" ADD VALUE IF NOT EXISTS 'high';
--> statement-breakpoint
ALTER TYPE "public"."service_request_priority" ADD VALUE IF NOT EXISTS 'urgent';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."service_request_status" AS ENUM('open', 'assigned', 'in_progress', 'resolved'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."service_request_status" ADD VALUE IF NOT EXISTS 'open';
--> statement-breakpoint
ALTER TYPE "public"."service_request_status" ADD VALUE IF NOT EXISTS 'assigned';
--> statement-breakpoint
ALTER TYPE "public"."service_request_status" ADD VALUE IF NOT EXISTS 'in_progress';
--> statement-breakpoint
ALTER TYPE "public"."service_request_status" ADD VALUE IF NOT EXISTS 'resolved';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."site_log_source" AS ENUM('whatsapp', 'manual'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."site_log_source" ADD VALUE IF NOT EXISTS 'whatsapp';
--> statement-breakpoint
ALTER TYPE "public"."site_log_source" ADD VALUE IF NOT EXISTS 'manual';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."site_visit_purpose" AS ENUM('initial', 'measurement', 'design_review', 'site_inspection', 'material_inspection', 'final_inspection', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."site_visit_purpose" ADD VALUE IF NOT EXISTS 'initial';
--> statement-breakpoint
ALTER TYPE "public"."site_visit_purpose" ADD VALUE IF NOT EXISTS 'measurement';
--> statement-breakpoint
ALTER TYPE "public"."site_visit_purpose" ADD VALUE IF NOT EXISTS 'design_review';
--> statement-breakpoint
ALTER TYPE "public"."site_visit_purpose" ADD VALUE IF NOT EXISTS 'site_inspection';
--> statement-breakpoint
ALTER TYPE "public"."site_visit_purpose" ADD VALUE IF NOT EXISTS 'material_inspection';
--> statement-breakpoint
ALTER TYPE "public"."site_visit_purpose" ADD VALUE IF NOT EXISTS 'final_inspection';
--> statement-breakpoint
ALTER TYPE "public"."site_visit_purpose" ADD VALUE IF NOT EXISTS 'other';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."site_visit_status" AS ENUM('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."site_visit_status" ADD VALUE IF NOT EXISTS 'scheduled';
--> statement-breakpoint
ALTER TYPE "public"."site_visit_status" ADD VALUE IF NOT EXISTS 'in_progress';
--> statement-breakpoint
ALTER TYPE "public"."site_visit_status" ADD VALUE IF NOT EXISTS 'completed';
--> statement-breakpoint
ALTER TYPE "public"."site_visit_status" ADD VALUE IF NOT EXISTS 'cancelled';
--> statement-breakpoint
ALTER TYPE "public"."site_visit_status" ADD VALUE IF NOT EXISTS 'no_show';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."snag_status" AS ENUM('open', 'in_progress', 'resolved', 'client_confirmed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."snag_status" ADD VALUE IF NOT EXISTS 'open';
--> statement-breakpoint
ALTER TYPE "public"."snag_status" ADD VALUE IF NOT EXISTS 'in_progress';
--> statement-breakpoint
ALTER TYPE "public"."snag_status" ADD VALUE IF NOT EXISTS 'resolved';
--> statement-breakpoint
ALTER TYPE "public"."snag_status" ADD VALUE IF NOT EXISTS 'client_confirmed';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."user_role" AS ENUM('owner', 'designer', 'supervisor', 'accountant', 'admin', 'employee'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'owner';
--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'designer';
--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'supervisor';
--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'accountant';
--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'admin';
--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'employee';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."work_order_priority" AS ENUM('low', 'normal', 'high', 'urgent'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."work_order_priority" ADD VALUE IF NOT EXISTS 'low';
--> statement-breakpoint
ALTER TYPE "public"."work_order_priority" ADD VALUE IF NOT EXISTS 'normal';
--> statement-breakpoint
ALTER TYPE "public"."work_order_priority" ADD VALUE IF NOT EXISTS 'high';
--> statement-breakpoint
ALTER TYPE "public"."work_order_priority" ADD VALUE IF NOT EXISTS 'urgent';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."work_order_status" AS ENUM('draft', 'assigned', 'in_progress', 'on_hold', 'completed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."work_order_status" ADD VALUE IF NOT EXISTS 'draft';
--> statement-breakpoint
ALTER TYPE "public"."work_order_status" ADD VALUE IF NOT EXISTS 'assigned';
--> statement-breakpoint
ALTER TYPE "public"."work_order_status" ADD VALUE IF NOT EXISTS 'in_progress';
--> statement-breakpoint
ALTER TYPE "public"."work_order_status" ADD VALUE IF NOT EXISTS 'on_hold';
--> statement-breakpoint
ALTER TYPE "public"."work_order_status" ADD VALUE IF NOT EXISTS 'completed';
--> statement-breakpoint
ALTER TYPE "public"."work_order_status" ADD VALUE IF NOT EXISTS 'cancelled';
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."work_order_type" AS ENUM('inhouse_carpentry', 'factory', 'vendor_job', 'site_work'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TYPE "public"."work_order_type" ADD VALUE IF NOT EXISTS 'inhouse_carpentry';
--> statement-breakpoint
ALTER TYPE "public"."work_order_type" ADD VALUE IF NOT EXISTS 'factory';
--> statement-breakpoint
ALTER TYPE "public"."work_order_type" ADD VALUE IF NOT EXISTS 'vendor_job';
--> statement-breakpoint
ALTER TYPE "public"."work_order_type" ADD VALUE IF NOT EXISTS 'site_work';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"password" text,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"action_type" text NOT NULL,
	"target_user_id" uuid,
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" text DEFAULT 'success' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "attendance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"status" "attendance_status" DEFAULT 'present' NOT NULL,
	"check_in_at" timestamp with time zone,
	"check_out_at" timestamp with time zone,
	"check_in_latitude" numeric(10, 7),
	"check_in_longitude" numeric(10, 7),
	"check_in_address" text,
	"notes" text,
	"marked_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "civil_branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"city_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"contact_name" text,
	"contact_phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "civil_cities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "civil_companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"gstin" text,
	"address" text,
	"contact_name" text,
	"contact_phone" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "civil_job_costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"description" text NOT NULL,
	"amount_paise" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "civil_job_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"from_status" "civil_job_status",
	"to_status" "civil_job_status" NOT NULL,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "civil_job_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"description" text NOT NULL,
	"kind" "civil_line_kind" DEFAULT 'material' NOT NULL,
	"amount_paise" bigint DEFAULT 0 NOT NULL,
	"cost_paise" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "civil_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"job_no" integer NOT NULL,
	"branch_id" uuid NOT NULL,
	"job_date" date NOT NULL,
	"heading" text NOT NULL,
	"remark" text,
	"manager_id" uuid,
	"status" "civil_job_status" DEFAULT 'done' NOT NULL,
	"bill_no" text,
	"bill_date" date,
	"paid_date" date,
	"total_paise" bigint DEFAULT 0 NOT NULL,
	"cost_paise" bigint DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "civil_managers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"type" "customer_activity_type" NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"metadata_json" jsonb,
	"scheduled_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"performed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"owner_id" uuid,
	"full_name" text NOT NULL,
	"email" text,
	"phone" text NOT NULL,
	"company" text,
	"city" text,
	"address" text,
	"source" "customer_source" DEFAULT 'other' NOT NULL,
	"stage" "customer_stage" DEFAULT 'lead' NOT NULL,
	"lead_id" uuid,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"notes" text,
	"last_contacted_at" timestamp with time zone,
	"health_score" smallint,
	"health_status" "customer_health_status",
	"health_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deliverable_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deliverable_id" uuid NOT NULL,
	"version_id" uuid,
	"body" text NOT NULL,
	"from_client" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deliverable_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deliverable_id" uuid NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"file_url" text NOT NULL,
	"file_type" text,
	"shared_at" timestamp with time zone,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deliverables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"type" "deliverable_type" NOT NULL,
	"status" "deliverable_status" DEFAULT 'pending' NOT NULL,
	"revision_count" integer DEFAULT 0 NOT NULL,
	"revision_cap" integer DEFAULT 2 NOT NULL,
	"latest_file_url" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "design_deliverables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"lead_id" uuid,
	"project_id" uuid,
	"type" "design_deliverable_type" NOT NULL,
	"title" text NOT NULL,
	"revision_cap" integer DEFAULT 3 NOT NULL,
	"status" "design_deliverable_status" DEFAULT 'draft' NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by_client" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "design_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"status" "design_task_status" DEFAULT 'todo' NOT NULL,
	"priority" "design_task_priority" DEFAULT 'normal' NOT NULL,
	"due_date" date,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"parent_id" uuid,
	"kind" "document_kind" NOT NULL,
	"name" text NOT NULL,
	"mime_type" text,
	"size_bytes" integer,
	"storage_path" text,
	"project_id" uuid,
	"lead_id" uuid,
	"uploaded_by" uuid,
	"starred" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"category" "expense_category" NOT NULL,
	"amount_paise" integer NOT NULL,
	"description" text,
	"receipt_url" text,
	"logged_by" uuid,
	"logged_via" text DEFAULT 'manual' NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"vendor_name" text,
	"vendor_id" uuid,
	"gst_pct" integer DEFAULT 0 NOT NULL,
	"gst_amount_paise" integer DEFAULT 0 NOT NULL,
	"expense_number" text,
	"due_date" date,
	"paid_at" timestamp with time zone,
	"payment_mode" text,
	"payee_type" "payee_type",
	"po_id" uuid,
	"voided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "grns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"po_id" uuid NOT NULL,
	"line_id" uuid,
	"delivered_qty" integer NOT NULL,
	"photo_proof" text[] DEFAULT '{}'::text[] NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"grn_number" text,
	"delivery_date" date,
	"received_by" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"invoice_number" text NOT NULL,
	"invoice_date" date NOT NULL,
	"hsn_sac_lines_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subtotal_paise" integer DEFAULT 0 NOT NULL,
	"cgst_paise" integer DEFAULT 0 NOT NULL,
	"sgst_paise" integer DEFAULT 0 NOT NULL,
	"igst_paise" integer DEFAULT 0 NOT NULL,
	"place_of_supply" text,
	"is_interstate" boolean DEFAULT false NOT NULL,
	"irn" text,
	"qr_code_url" text,
	"pdf_url" text,
	"status" "invoice_lifecycle_status" DEFAULT 'draft' NOT NULL,
	"issued_at" timestamp with time zone,
	"due_date" date,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lead_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"type" "lead_activity_type" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"contact_method" text,
	"scheduled_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"status" "follow_up_status",
	"metadata_json" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lead_follow_ups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"follow_up_date" timestamp with time zone,
	"follow_up_type" "follow_up_type",
	"stage" text NOT NULL,
	"client_status" text NOT NULL,
	"comments" text,
	"completed_at" timestamp with time zone,
	"rescheduled_from_id" uuid,
	"rescheduled_notes" text,
	"add_to_calendar" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid,
	"source" "lead_source" DEFAULT 'whatsapp' NOT NULL,
	"stage" "lead_stage" DEFAULT 'new' NOT NULL,
	"priority" "lead_priority",
	"owner_id" uuid,
	"contact_name" text NOT NULL,
	"contact_phone" text NOT NULL,
	"alternate_phone" text,
	"contact_email" text,
	"contact_city" text,
	"pincode" text,
	"property_type" text,
	"project_name" text,
	"project_location" text,
	"budget_band" text,
	"project_value_paise" bigint,
	"designer_name" text,
	"follow_up_date" timestamp with time zone,
	"lost_reason" text,
	"notes" text,
	"preferred_language" text DEFAULT 'en',
	"score" smallint DEFAULT 0,
	"score_breakdown" jsonb,
	"first_touch_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"cold_flag_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leave_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"leave_type" "leave_type" NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"reason" text NOT NULL,
	"status" "leave_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ledger_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"project_id" uuid,
	"kind" "ledger_adjustment_kind" NOT NULL,
	"amount_paise" bigint NOT NULL,
	"reason" text NOT NULL,
	"adj_date" date DEFAULT current_date NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"category" "material_category" NOT NULL,
	"name" text NOT NULL,
	"brand" text,
	"vendor_id" uuid,
	"unit" text DEFAULT 'nos' NOT NULL,
	"current_rate_paise" integer DEFAULT 0 NOT NULL,
	"selling_rate_paise" integer DEFAULT 0 NOT NULL,
	"last_purchase_price_paise" integer,
	"price_history_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hsn_sac" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "measurement_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"floor" text,
	"room" text NOT NULL,
	"item_name" text NOT NULL,
	"dimensions_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	"unit" text DEFAULT 'sqft' NOT NULL,
	"area_sqft" numeric(10, 3),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "measurement_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"project_id" uuid,
	"site_visit_id" uuid,
	"status" "measurement_round_status" DEFAULT 'draft' NOT NULL,
	"measurement_number" text,
	"round_name" text DEFAULT 'Round 1' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"assigned_to_id" uuid,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"label" text NOT NULL,
	"pct_of_total" integer NOT NULL,
	"amount_paise" bigint DEFAULT 0 NOT NULL,
	"trigger_stage" "project_stage",
	"due_on" date,
	"due_since" date,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"invoice_id" uuid,
	"payment_status" "payment_status" DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp with time zone,
	"razorpay_link_id" text,
	"promised_at" timestamp with time zone,
	"promised_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid,
	"severity" "notification_severity" DEFAULT 'info' NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"href" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"milestone_id" uuid NOT NULL,
	"amount_paise" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"invoice_id" uuid,
	"razorpay_link_id" text,
	"razorpay_payment_id" text,
	"amount_paise" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"pdf_url" text,
	"reconciled_at" timestamp with time zone,
	"manual_override_by" uuid,
	"manual_override_note" text,
	"receipt_number" text,
	"mode" "payment_mode",
	"reference" text,
	"received_at" timestamp with time zone,
	"recorded_by" uuid,
	"note" text,
	"customer_id" uuid,
	"project_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_razorpay_payment_id_unique" UNIQUE("razorpay_payment_id"),
	CONSTRAINT "payments_receipt_number_unique" UNIQUE("receipt_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payroll_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"month" text NOT NULL,
	"status" "payroll_run_status" DEFAULT 'draft' NOT NULL,
	"working_days" integer DEFAULT 26 NOT NULL,
	"total_gross_paise" integer DEFAULT 0 NOT NULL,
	"total_net_paise" integer DEFAULT 0 NOT NULL,
	"total_employee_pf_paise" integer DEFAULT 0 NOT NULL,
	"total_employee_esi_paise" integer DEFAULT 0 NOT NULL,
	"total_employer_pf_paise" integer DEFAULT 0 NOT NULL,
	"total_employer_esi_paise" integer DEFAULT 0 NOT NULL,
	"total_cost_paise" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payslips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"days_present" numeric(5, 1) DEFAULT '0' NOT NULL,
	"days_absent" numeric(5, 1) DEFAULT '0' NOT NULL,
	"gross_paise" integer DEFAULT 0 NOT NULL,
	"employee_pf_paise" integer DEFAULT 0 NOT NULL,
	"employee_esi_paise" integer DEFAULT 0 NOT NULL,
	"net_paise" integer DEFAULT 0 NOT NULL,
	"employer_pf_paise" integer DEFAULT 0 NOT NULL,
	"employer_esi_paise" integer DEFAULT 0 NOT NULL,
	"total_cost_paise" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "portfolios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"cover_photo_url" text,
	"photos" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"client_consent" boolean DEFAULT false NOT NULL,
	"ai_curated_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_additions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"description" text NOT NULL,
	"amount_paise" bigint NOT NULL,
	"added_on" date DEFAULT current_date NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"lead_id" uuid,
	"client_id" uuid,
	"customer_id" uuid,
	"name" text DEFAULT '' NOT NULL,
	"designer_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"total_contract_paise" bigint,
	"gst_pct" smallint DEFAULT 18 NOT NULL,
	"handover_at" timestamp with time zone,
	"lifecycle_stage" "project_stage" DEFAULT 'design_pending' NOT NULL,
	"timeline_json" jsonb,
	"started_at" timestamp with time zone,
	"expected_end_at" timestamp with time zone,
	"client_portal_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_client_portal_token_unique" UNIQUE("client_portal_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"vendor_id" uuid,
	"po_number" text NOT NULL,
	"lines_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "po_status" DEFAULT 'draft' NOT NULL,
	"advance_paid_paise" integer DEFAULT 0 NOT NULL,
	"expected_delivery_at" timestamp with time zone,
	"pdf_url" text,
	"wa_message_id" text,
	"vendor_phone" text,
	"vendor_contact_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quote_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"room" text NOT NULL,
	"item" text NOT NULL,
	"description" text,
	"qty" integer DEFAULT 1 NOT NULL,
	"unit" text DEFAULT 'nos' NOT NULL,
	"client_rate_paise" integer DEFAULT 0 NOT NULL,
	"cost_rate_paise" integer DEFAULT 0 NOT NULL,
	"margin_paise" integer DEFAULT 0 NOT NULL,
	"hsn_sac" text,
	"finish" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"material_id" uuid,
	"section_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quote_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"room" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid,
	"lead_id" uuid,
	"parent_quote_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"quote_number" text,
	"subtotal_paise" integer DEFAULT 0 NOT NULL,
	"discount_paise" integer DEFAULT 0 NOT NULL,
	"gst_pct" integer DEFAULT 18 NOT NULL,
	"gst_paise" integer DEFAULT 0 NOT NULL,
	"total_paise" integer DEFAULT 0 NOT NULL,
	"margin_paise" integer DEFAULT 0 NOT NULL,
	"pdf_url" text,
	"terms_text" text,
	"valid_until" date,
	"payment_terms" text,
	"sent_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"approval_audit_json" jsonb,
	"wa_message_id" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"rooms_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"style_tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"budget_band" text,
	"moodboard_urls" text[] DEFAULT '{}'::text[] NOT NULL,
	"total_area_sqft" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "service_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid,
	"project_id" uuid,
	"issue" text NOT NULL,
	"photo_url" text,
	"priority" "service_request_priority" DEFAULT 'medium' NOT NULL,
	"status" "service_request_status" DEFAULT 'open' NOT NULL,
	"assigned_to" uuid,
	"scheduled_visit_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "site_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"log_date" date NOT NULL,
	"photos" text[] DEFAULT '{}'::text[] NOT NULL,
	"voice_note_url" text,
	"transcript" text,
	"progress_pct" integer,
	"stage" text,
	"activity_type" text,
	"delay_flag" boolean DEFAULT false NOT NULL,
	"labour_count" integer,
	"blockers_json" jsonb,
	"ai_parsed_json" jsonb,
	"source" "site_log_source" DEFAULT 'manual' NOT NULL,
	"log_number" text,
	"follow_up_actions" text,
	"attachments" text[] DEFAULT '{}'::text[] NOT NULL,
	"related_work_order_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "site_visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"project_id" uuid,
	"designer_id" uuid,
	"status" "site_visit_status" DEFAULT 'scheduled' NOT NULL,
	"purpose" "site_visit_purpose",
	"visit_number" text,
	"scheduled_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"location_json" jsonb,
	"photos" text[] DEFAULT '{}'::text[] NOT NULL,
	"measurements_json" jsonb,
	"voice_notes" text[] DEFAULT '{}'::text[] NOT NULL,
	"notes" text,
	"follow_up_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "snag_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"description" text NOT NULL,
	"photo_url" text,
	"assignee_id" uuid,
	"status" "snag_status" DEFAULT 'open' NOT NULL,
	"client_confirmed_at" timestamp with time zone,
	"wa_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "staff_day_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid,
	"week_start" date NOT NULL,
	"days" numeric(3, 1) NOT NULL,
	"day_rate_paise" bigint NOT NULL,
	"cost_paise" bigint NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"assigned_to" uuid,
	"created_by" uuid,
	"related_type" text,
	"related_id" uuid,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"gstin" text,
	"branding_json" jsonb,
	"wa_config" jsonb,
	"tally_settings" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"supabase_uid" uuid,
	"role" "user_role" DEFAULT 'designer' NOT NULL,
	"full_name" text NOT NULL,
	"phone" text,
	"email" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"photo_url" text,
	"job_title" text,
	"department" text,
	"location" text,
	"employment_type" "employment_type",
	"hire_date" date,
	"dob" date,
	"manager_id" uuid,
	"emergency_contact_json" jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"salary_paise" integer,
	"permissions_json" jsonb DEFAULT '{"canSeeFinance":false,"canCreateQuotes":false,"canSendQuotes":false,"canRaisePO":false,"canRecordPayments":false,"canSeeAllLeads":false}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_supabase_uid_unique" UNIQUE("supabase_uid"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"vendor_id" uuid,
	"purchase_order_id" uuid,
	"expense_id" uuid,
	"amount_paise" bigint NOT NULL,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"method" text,
	"reference" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"gstin" text,
	"category" "material_category",
	"address" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wa_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"lead_id" uuid,
	"thread_id" text NOT NULL,
	"meta_message_id" text,
	"direction" "message_direction" NOT NULL,
	"category" "message_category",
	"template_name" text,
	"body_preview" text,
	"flow_response_json" jsonb,
	"cost_paise" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "work_order_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_order_id" uuid NOT NULL,
	"progress_pct" integer,
	"note" text,
	"photos" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "work_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"quote_line_id" uuid,
	"title" text NOT NULL,
	"type" "work_order_type" DEFAULT 'site_work' NOT NULL,
	"priority" "work_order_priority" DEFAULT 'normal' NOT NULL,
	"description" text,
	"room" text,
	"assigned_user_id" uuid,
	"assigned_vendor_id" uuid,
	"start_date" date,
	"due_date" date,
	"status" "work_order_status" DEFAULT 'draft' NOT NULL,
	"estimated_cost_paise" bigint DEFAULT 0 NOT NULL,
	"actual_cost_paise" bigint DEFAULT 0 NOT NULL,
	"materials_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"attachments" text[] DEFAULT '{}'::text[] NOT NULL,
	"notes" text,
	"work_order_number" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "user_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "account_id" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "provider_id" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "password" text;
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "access_token" text;
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "refresh_token" text;
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "id_token" text;
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "access_token_expires_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "refresh_token_expires_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "scope" text;
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "ai_actions" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "ai_actions" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "ai_actions" ADD COLUMN IF NOT EXISTS "requested_by" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "ai_actions" ADD COLUMN IF NOT EXISTS "action_type" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "ai_actions" ADD COLUMN IF NOT EXISTS "target_user_id" uuid;
--> statement-breakpoint
ALTER TABLE "ai_actions" ADD COLUMN IF NOT EXISTS "payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "ai_actions" ADD COLUMN IF NOT EXISTS "result" text DEFAULT 'success' NOT NULL;
--> statement-breakpoint
ALTER TABLE "ai_actions" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "user_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "date" date NOT NULL;
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "status" "attendance_status" DEFAULT 'present' NOT NULL;
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "check_in_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "check_out_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "check_in_latitude" numeric(10, 7);
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "check_in_longitude" numeric(10, 7);
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "check_in_address" text;
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "notes" text;
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "marked_by" uuid;
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_branches" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_branches" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_branches" ADD COLUMN IF NOT EXISTS "company_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_branches" ADD COLUMN IF NOT EXISTS "city_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_branches" ADD COLUMN IF NOT EXISTS "name" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_branches" ADD COLUMN IF NOT EXISTS "address" text;
--> statement-breakpoint
ALTER TABLE "civil_branches" ADD COLUMN IF NOT EXISTS "contact_name" text;
--> statement-breakpoint
ALTER TABLE "civil_branches" ADD COLUMN IF NOT EXISTS "contact_phone" text;
--> statement-breakpoint
ALTER TABLE "civil_branches" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_cities" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_cities" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_cities" ADD COLUMN IF NOT EXISTS "name" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_cities" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_companies" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_companies" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_companies" ADD COLUMN IF NOT EXISTS "name" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_companies" ADD COLUMN IF NOT EXISTS "gstin" text;
--> statement-breakpoint
ALTER TABLE "civil_companies" ADD COLUMN IF NOT EXISTS "address" text;
--> statement-breakpoint
ALTER TABLE "civil_companies" ADD COLUMN IF NOT EXISTS "contact_name" text;
--> statement-breakpoint
ALTER TABLE "civil_companies" ADD COLUMN IF NOT EXISTS "contact_phone" text;
--> statement-breakpoint
ALTER TABLE "civil_companies" ADD COLUMN IF NOT EXISTS "notes" text;
--> statement-breakpoint
ALTER TABLE "civil_companies" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_job_costs" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_job_costs" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_job_costs" ADD COLUMN IF NOT EXISTS "job_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_job_costs" ADD COLUMN IF NOT EXISTS "position" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_job_costs" ADD COLUMN IF NOT EXISTS "description" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_job_costs" ADD COLUMN IF NOT EXISTS "amount_paise" bigint DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_job_costs" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_job_events" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_job_events" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_job_events" ADD COLUMN IF NOT EXISTS "job_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_job_events" ADD COLUMN IF NOT EXISTS "from_status" "civil_job_status";
--> statement-breakpoint
ALTER TABLE "civil_job_events" ADD COLUMN IF NOT EXISTS "to_status" "civil_job_status" NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_job_events" ADD COLUMN IF NOT EXISTS "note" text;
--> statement-breakpoint
ALTER TABLE "civil_job_events" ADD COLUMN IF NOT EXISTS "created_by" uuid;
--> statement-breakpoint
ALTER TABLE "civil_job_events" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_job_lines" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_job_lines" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_job_lines" ADD COLUMN IF NOT EXISTS "job_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_job_lines" ADD COLUMN IF NOT EXISTS "position" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_job_lines" ADD COLUMN IF NOT EXISTS "description" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_job_lines" ADD COLUMN IF NOT EXISTS "kind" "civil_line_kind" DEFAULT 'material' NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_job_lines" ADD COLUMN IF NOT EXISTS "amount_paise" bigint DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_job_lines" ADD COLUMN IF NOT EXISTS "cost_paise" bigint;
--> statement-breakpoint
ALTER TABLE "civil_job_lines" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_jobs" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_jobs" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_jobs" ADD COLUMN IF NOT EXISTS "job_no" integer NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_jobs" ADD COLUMN IF NOT EXISTS "branch_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_jobs" ADD COLUMN IF NOT EXISTS "job_date" date NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_jobs" ADD COLUMN IF NOT EXISTS "heading" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_jobs" ADD COLUMN IF NOT EXISTS "remark" text;
--> statement-breakpoint
ALTER TABLE "civil_jobs" ADD COLUMN IF NOT EXISTS "manager_id" uuid;
--> statement-breakpoint
ALTER TABLE "civil_jobs" ADD COLUMN IF NOT EXISTS "status" "civil_job_status" DEFAULT 'done' NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_jobs" ADD COLUMN IF NOT EXISTS "bill_no" text;
--> statement-breakpoint
ALTER TABLE "civil_jobs" ADD COLUMN IF NOT EXISTS "bill_date" date;
--> statement-breakpoint
ALTER TABLE "civil_jobs" ADD COLUMN IF NOT EXISTS "paid_date" date;
--> statement-breakpoint
ALTER TABLE "civil_jobs" ADD COLUMN IF NOT EXISTS "total_paise" bigint DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_jobs" ADD COLUMN IF NOT EXISTS "cost_paise" bigint DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_jobs" ADD COLUMN IF NOT EXISTS "created_by" uuid;
--> statement-breakpoint
ALTER TABLE "civil_jobs" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_jobs" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_managers" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_managers" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_managers" ADD COLUMN IF NOT EXISTS "name" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_managers" ADD COLUMN IF NOT EXISTS "phone" text;
--> statement-breakpoint
ALTER TABLE "civil_managers" ADD COLUMN IF NOT EXISTS "active" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "civil_managers" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "client_tokens" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "client_tokens" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "client_tokens" ADD COLUMN IF NOT EXISTS "project_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "client_tokens" ADD COLUMN IF NOT EXISTS "token" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "client_tokens" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone NOT NULL;
--> statement-breakpoint
ALTER TABLE "client_tokens" ADD COLUMN IF NOT EXISTS "revoked_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "client_tokens" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "customer_activities" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "customer_activities" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "customer_activities" ADD COLUMN IF NOT EXISTS "customer_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "customer_activities" ADD COLUMN IF NOT EXISTS "type" "customer_activity_type" NOT NULL;
--> statement-breakpoint
ALTER TABLE "customer_activities" ADD COLUMN IF NOT EXISTS "title" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "customer_activities" ADD COLUMN IF NOT EXISTS "body" text;
--> statement-breakpoint
ALTER TABLE "customer_activities" ADD COLUMN IF NOT EXISTS "metadata_json" jsonb;
--> statement-breakpoint
ALTER TABLE "customer_activities" ADD COLUMN IF NOT EXISTS "scheduled_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "customer_activities" ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "customer_activities" ADD COLUMN IF NOT EXISTS "performed_by" uuid;
--> statement-breakpoint
ALTER TABLE "customer_activities" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "owner_id" uuid;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "full_name" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "email" text;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "phone" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "company" text;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "city" text;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "address" text;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "source" "customer_source" DEFAULT 'other' NOT NULL;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "stage" "customer_stage" DEFAULT 'lead' NOT NULL;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "lead_id" uuid;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "tags" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "notes" text;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "last_contacted_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "health_score" smallint;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "health_status" "customer_health_status";
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "health_updated_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "deliverable_comments" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "deliverable_comments" ADD COLUMN IF NOT EXISTS "deliverable_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "deliverable_comments" ADD COLUMN IF NOT EXISTS "version_id" uuid;
--> statement-breakpoint
ALTER TABLE "deliverable_comments" ADD COLUMN IF NOT EXISTS "body" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "deliverable_comments" ADD COLUMN IF NOT EXISTS "from_client" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "deliverable_comments" ADD COLUMN IF NOT EXISTS "created_by" uuid;
--> statement-breakpoint
ALTER TABLE "deliverable_comments" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "deliverable_versions" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "deliverable_versions" ADD COLUMN IF NOT EXISTS "deliverable_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "deliverable_versions" ADD COLUMN IF NOT EXISTS "version_number" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "deliverable_versions" ADD COLUMN IF NOT EXISTS "file_url" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "deliverable_versions" ADD COLUMN IF NOT EXISTS "file_type" text;
--> statement-breakpoint
ALTER TABLE "deliverable_versions" ADD COLUMN IF NOT EXISTS "shared_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "deliverable_versions" ADD COLUMN IF NOT EXISTS "notes" text;
--> statement-breakpoint
ALTER TABLE "deliverable_versions" ADD COLUMN IF NOT EXISTS "created_by" uuid;
--> statement-breakpoint
ALTER TABLE "deliverable_versions" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "deliverables" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "deliverables" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "deliverables" ADD COLUMN IF NOT EXISTS "project_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "deliverables" ADD COLUMN IF NOT EXISTS "type" "deliverable_type" NOT NULL;
--> statement-breakpoint
ALTER TABLE "deliverables" ADD COLUMN IF NOT EXISTS "status" "deliverable_status" DEFAULT 'pending' NOT NULL;
--> statement-breakpoint
ALTER TABLE "deliverables" ADD COLUMN IF NOT EXISTS "revision_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "deliverables" ADD COLUMN IF NOT EXISTS "revision_cap" integer DEFAULT 2 NOT NULL;
--> statement-breakpoint
ALTER TABLE "deliverables" ADD COLUMN IF NOT EXISTS "latest_file_url" text;
--> statement-breakpoint
ALTER TABLE "deliverables" ADD COLUMN IF NOT EXISTS "approved_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "deliverables" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "design_deliverables" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "design_deliverables" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "design_deliverables" ADD COLUMN IF NOT EXISTS "lead_id" uuid;
--> statement-breakpoint
ALTER TABLE "design_deliverables" ADD COLUMN IF NOT EXISTS "project_id" uuid;
--> statement-breakpoint
ALTER TABLE "design_deliverables" ADD COLUMN IF NOT EXISTS "type" "design_deliverable_type" NOT NULL;
--> statement-breakpoint
ALTER TABLE "design_deliverables" ADD COLUMN IF NOT EXISTS "title" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "design_deliverables" ADD COLUMN IF NOT EXISTS "revision_cap" integer DEFAULT 3 NOT NULL;
--> statement-breakpoint
ALTER TABLE "design_deliverables" ADD COLUMN IF NOT EXISTS "status" "design_deliverable_status" DEFAULT 'draft' NOT NULL;
--> statement-breakpoint
ALTER TABLE "design_deliverables" ADD COLUMN IF NOT EXISTS "approved_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "design_deliverables" ADD COLUMN IF NOT EXISTS "approved_by_client" text;
--> statement-breakpoint
ALTER TABLE "design_deliverables" ADD COLUMN IF NOT EXISTS "created_by" uuid;
--> statement-breakpoint
ALTER TABLE "design_deliverables" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "design_tasks" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "design_tasks" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "design_tasks" ADD COLUMN IF NOT EXISTS "project_id" uuid;
--> statement-breakpoint
ALTER TABLE "design_tasks" ADD COLUMN IF NOT EXISTS "title" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "design_tasks" ADD COLUMN IF NOT EXISTS "description" text;
--> statement-breakpoint
ALTER TABLE "design_tasks" ADD COLUMN IF NOT EXISTS "status" "design_task_status" DEFAULT 'todo' NOT NULL;
--> statement-breakpoint
ALTER TABLE "design_tasks" ADD COLUMN IF NOT EXISTS "priority" "design_task_priority" DEFAULT 'normal' NOT NULL;
--> statement-breakpoint
ALTER TABLE "design_tasks" ADD COLUMN IF NOT EXISTS "due_date" date;
--> statement-breakpoint
ALTER TABLE "design_tasks" ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "design_tasks" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "parent_id" uuid;
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "kind" "document_kind" NOT NULL;
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "name" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "mime_type" text;
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "size_bytes" integer;
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "storage_path" text;
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "project_id" uuid;
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "lead_id" uuid;
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "uploaded_by" uuid;
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "starred" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "project_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "category" "expense_category" NOT NULL;
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "amount_paise" integer NOT NULL;
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "description" text;
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "receipt_url" text;
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "logged_by" uuid;
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "logged_via" text DEFAULT 'manual' NOT NULL;
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "approved_by" uuid;
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "approved_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "vendor_name" text;
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "vendor_id" uuid;
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "gst_pct" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "gst_amount_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "expense_number" text;
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "due_date" date;
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "paid_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "payment_mode" text;
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "payee_type" "payee_type";
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "po_id" uuid;
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "voided_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "grns" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "grns" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "grns" ADD COLUMN IF NOT EXISTS "po_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "grns" ADD COLUMN IF NOT EXISTS "line_id" uuid;
--> statement-breakpoint
ALTER TABLE "grns" ADD COLUMN IF NOT EXISTS "delivered_qty" integer NOT NULL;
--> statement-breakpoint
ALTER TABLE "grns" ADD COLUMN IF NOT EXISTS "photo_proof" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
ALTER TABLE "grns" ADD COLUMN IF NOT EXISTS "received_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "grns" ADD COLUMN IF NOT EXISTS "notes" text;
--> statement-breakpoint
ALTER TABLE "grns" ADD COLUMN IF NOT EXISTS "grn_number" text;
--> statement-breakpoint
ALTER TABLE "grns" ADD COLUMN IF NOT EXISTS "delivery_date" date;
--> statement-breakpoint
ALTER TABLE "grns" ADD COLUMN IF NOT EXISTS "received_by" uuid;
--> statement-breakpoint
ALTER TABLE "grns" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active' NOT NULL;
--> statement-breakpoint
ALTER TABLE "grns" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "project_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "invoice_number" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "invoice_date" date NOT NULL;
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "hsn_sac_lines_json" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "subtotal_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "cgst_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "sgst_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "igst_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "place_of_supply" text;
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "is_interstate" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "irn" text;
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "qr_code_url" text;
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "pdf_url" text;
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "status" "invoice_lifecycle_status" DEFAULT 'draft' NOT NULL;
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "issued_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "due_date" date;
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "voided_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "void_reason" text;
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "notes" text;
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "lead_activities" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "lead_activities" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "lead_activities" ADD COLUMN IF NOT EXISTS "lead_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "lead_activities" ADD COLUMN IF NOT EXISTS "type" "lead_activity_type" NOT NULL;
--> statement-breakpoint
ALTER TABLE "lead_activities" ADD COLUMN IF NOT EXISTS "title" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "lead_activities" ADD COLUMN IF NOT EXISTS "description" text;
--> statement-breakpoint
ALTER TABLE "lead_activities" ADD COLUMN IF NOT EXISTS "contact_method" text;
--> statement-breakpoint
ALTER TABLE "lead_activities" ADD COLUMN IF NOT EXISTS "scheduled_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "lead_activities" ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "lead_activities" ADD COLUMN IF NOT EXISTS "status" "follow_up_status";
--> statement-breakpoint
ALTER TABLE "lead_activities" ADD COLUMN IF NOT EXISTS "metadata_json" jsonb;
--> statement-breakpoint
ALTER TABLE "lead_activities" ADD COLUMN IF NOT EXISTS "created_by" uuid;
--> statement-breakpoint
ALTER TABLE "lead_activities" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "lead_follow_ups" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "lead_follow_ups" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "lead_follow_ups" ADD COLUMN IF NOT EXISTS "lead_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "lead_follow_ups" ADD COLUMN IF NOT EXISTS "follow_up_date" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "lead_follow_ups" ADD COLUMN IF NOT EXISTS "follow_up_type" "follow_up_type";
--> statement-breakpoint
ALTER TABLE "lead_follow_ups" ADD COLUMN IF NOT EXISTS "stage" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "lead_follow_ups" ADD COLUMN IF NOT EXISTS "client_status" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "lead_follow_ups" ADD COLUMN IF NOT EXISTS "comments" text;
--> statement-breakpoint
ALTER TABLE "lead_follow_ups" ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "lead_follow_ups" ADD COLUMN IF NOT EXISTS "rescheduled_from_id" uuid;
--> statement-breakpoint
ALTER TABLE "lead_follow_ups" ADD COLUMN IF NOT EXISTS "rescheduled_notes" text;
--> statement-breakpoint
ALTER TABLE "lead_follow_ups" ADD COLUMN IF NOT EXISTS "add_to_calendar" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "lead_follow_ups" ADD COLUMN IF NOT EXISTS "created_by" uuid;
--> statement-breakpoint
ALTER TABLE "lead_follow_ups" ADD COLUMN IF NOT EXISTS "updated_by" uuid;
--> statement-breakpoint
ALTER TABLE "lead_follow_ups" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "lead_follow_ups" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "customer_id" uuid;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "source" "lead_source" DEFAULT 'whatsapp' NOT NULL;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "stage" "lead_stage" DEFAULT 'new' NOT NULL;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "priority" "lead_priority";
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "owner_id" uuid;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "contact_name" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "contact_phone" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "alternate_phone" text;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "contact_email" text;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "contact_city" text;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "pincode" text;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "property_type" text;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "project_name" text;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "project_location" text;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "budget_band" text;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "project_value_paise" bigint;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "designer_name" text;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "follow_up_date" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "lost_reason" text;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "notes" text;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "preferred_language" text DEFAULT 'en';
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "score" smallint DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "score_breakdown" jsonb;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "first_touch_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "last_activity_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "cold_flag_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "user_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "leave_type" "leave_type" NOT NULL;
--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "from_date" date NOT NULL;
--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "to_date" date NOT NULL;
--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "reason" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "status" "leave_status" DEFAULT 'pending' NOT NULL;
--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "reviewed_by" uuid;
--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "review_note" text;
--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "ledger_adjustments" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "ledger_adjustments" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "ledger_adjustments" ADD COLUMN IF NOT EXISTS "customer_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "ledger_adjustments" ADD COLUMN IF NOT EXISTS "project_id" uuid;
--> statement-breakpoint
ALTER TABLE "ledger_adjustments" ADD COLUMN IF NOT EXISTS "kind" "ledger_adjustment_kind" NOT NULL;
--> statement-breakpoint
ALTER TABLE "ledger_adjustments" ADD COLUMN IF NOT EXISTS "amount_paise" bigint NOT NULL;
--> statement-breakpoint
ALTER TABLE "ledger_adjustments" ADD COLUMN IF NOT EXISTS "reason" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "ledger_adjustments" ADD COLUMN IF NOT EXISTS "adj_date" date DEFAULT current_date NOT NULL;
--> statement-breakpoint
ALTER TABLE "ledger_adjustments" ADD COLUMN IF NOT EXISTS "created_by" uuid;
--> statement-breakpoint
ALTER TABLE "ledger_adjustments" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "category" "material_category" NOT NULL;
--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "name" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "brand" text;
--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "vendor_id" uuid;
--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "unit" text DEFAULT 'nos' NOT NULL;
--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "current_rate_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "selling_rate_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "last_purchase_price_paise" integer;
--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "price_history_json" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "hsn_sac" text;
--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "notes" text;
--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "measurement_items" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "measurement_items" ADD COLUMN IF NOT EXISTS "round_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "measurement_items" ADD COLUMN IF NOT EXISTS "floor" text;
--> statement-breakpoint
ALTER TABLE "measurement_items" ADD COLUMN IF NOT EXISTS "room" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "measurement_items" ADD COLUMN IF NOT EXISTS "item_name" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "measurement_items" ADD COLUMN IF NOT EXISTS "dimensions_json" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "measurement_items" ADD COLUMN IF NOT EXISTS "qty" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "measurement_items" ADD COLUMN IF NOT EXISTS "unit" text DEFAULT 'sqft' NOT NULL;
--> statement-breakpoint
ALTER TABLE "measurement_items" ADD COLUMN IF NOT EXISTS "area_sqft" numeric(10, 3);
--> statement-breakpoint
ALTER TABLE "measurement_items" ADD COLUMN IF NOT EXISTS "notes" text;
--> statement-breakpoint
ALTER TABLE "measurement_items" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "measurement_rounds" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "measurement_rounds" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "measurement_rounds" ADD COLUMN IF NOT EXISTS "lead_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "measurement_rounds" ADD COLUMN IF NOT EXISTS "project_id" uuid;
--> statement-breakpoint
ALTER TABLE "measurement_rounds" ADD COLUMN IF NOT EXISTS "site_visit_id" uuid;
--> statement-breakpoint
ALTER TABLE "measurement_rounds" ADD COLUMN IF NOT EXISTS "status" "measurement_round_status" DEFAULT 'draft' NOT NULL;
--> statement-breakpoint
ALTER TABLE "measurement_rounds" ADD COLUMN IF NOT EXISTS "measurement_number" text;
--> statement-breakpoint
ALTER TABLE "measurement_rounds" ADD COLUMN IF NOT EXISTS "round_name" text DEFAULT 'Round 1' NOT NULL;
--> statement-breakpoint
ALTER TABLE "measurement_rounds" ADD COLUMN IF NOT EXISTS "scheduled_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "measurement_rounds" ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "measurement_rounds" ADD COLUMN IF NOT EXISTS "assigned_to_id" uuid;
--> statement-breakpoint
ALTER TABLE "measurement_rounds" ADD COLUMN IF NOT EXISTS "notes" text;
--> statement-breakpoint
ALTER TABLE "measurement_rounds" ADD COLUMN IF NOT EXISTS "created_by" uuid;
--> statement-breakpoint
ALTER TABLE "measurement_rounds" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN IF NOT EXISTS "project_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN IF NOT EXISTS "label" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN IF NOT EXISTS "pct_of_total" integer NOT NULL;
--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN IF NOT EXISTS "amount_paise" bigint DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN IF NOT EXISTS "trigger_stage" "project_stage";
--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN IF NOT EXISTS "due_on" date;
--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN IF NOT EXISTS "due_since" date;
--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN IF NOT EXISTS "invoice_id" uuid;
--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN IF NOT EXISTS "payment_status" "payment_status" DEFAULT 'pending' NOT NULL;
--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN IF NOT EXISTS "paid_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN IF NOT EXISTS "razorpay_link_id" text;
--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN IF NOT EXISTS "promised_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN IF NOT EXISTS "promised_note" text;
--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "user_id" uuid;
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "severity" "notification_severity" DEFAULT 'info' NOT NULL;
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "title" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "body" text;
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "href" text;
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "read_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD COLUMN IF NOT EXISTS "payment_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD COLUMN IF NOT EXISTS "milestone_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD COLUMN IF NOT EXISTS "amount_paise" bigint NOT NULL;
--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "invoice_id" uuid;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "razorpay_link_id" text;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "razorpay_payment_id" text;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "amount_paise" integer NOT NULL;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending' NOT NULL;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "pdf_url" text;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "reconciled_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "manual_override_by" uuid;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "manual_override_note" text;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "receipt_number" text;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "mode" "payment_mode";
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "reference" text;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "received_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "recorded_by" uuid;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "note" text;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "customer_id" uuid;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "project_id" uuid;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "month" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "status" "payroll_run_status" DEFAULT 'draft' NOT NULL;
--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "working_days" integer DEFAULT 26 NOT NULL;
--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "total_gross_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "total_net_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "total_employee_pf_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "total_employee_esi_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "total_employer_pf_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "total_employer_esi_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "total_cost_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "notes" text;
--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "created_by" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "payslips" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "payslips" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "payslips" ADD COLUMN IF NOT EXISTS "run_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "payslips" ADD COLUMN IF NOT EXISTS "user_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "payslips" ADD COLUMN IF NOT EXISTS "days_present" numeric(5, 1) DEFAULT '0' NOT NULL;
--> statement-breakpoint
ALTER TABLE "payslips" ADD COLUMN IF NOT EXISTS "days_absent" numeric(5, 1) DEFAULT '0' NOT NULL;
--> statement-breakpoint
ALTER TABLE "payslips" ADD COLUMN IF NOT EXISTS "gross_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "payslips" ADD COLUMN IF NOT EXISTS "employee_pf_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "payslips" ADD COLUMN IF NOT EXISTS "employee_esi_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "payslips" ADD COLUMN IF NOT EXISTS "net_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "payslips" ADD COLUMN IF NOT EXISTS "employer_pf_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "payslips" ADD COLUMN IF NOT EXISTS "employer_esi_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "payslips" ADD COLUMN IF NOT EXISTS "total_cost_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "payslips" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "portfolios" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "portfolios" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "portfolios" ADD COLUMN IF NOT EXISTS "project_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "portfolios" ADD COLUMN IF NOT EXISTS "title" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "portfolios" ADD COLUMN IF NOT EXISTS "cover_photo_url" text;
--> statement-breakpoint
ALTER TABLE "portfolios" ADD COLUMN IF NOT EXISTS "photos" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
ALTER TABLE "portfolios" ADD COLUMN IF NOT EXISTS "is_public" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "portfolios" ADD COLUMN IF NOT EXISTS "client_consent" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "portfolios" ADD COLUMN IF NOT EXISTS "ai_curated_json" jsonb;
--> statement-breakpoint
ALTER TABLE "portfolios" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "project_additions" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "project_additions" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "project_additions" ADD COLUMN IF NOT EXISTS "project_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "project_additions" ADD COLUMN IF NOT EXISTS "description" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "project_additions" ADD COLUMN IF NOT EXISTS "amount_paise" bigint NOT NULL;
--> statement-breakpoint
ALTER TABLE "project_additions" ADD COLUMN IF NOT EXISTS "added_on" date DEFAULT current_date NOT NULL;
--> statement-breakpoint
ALTER TABLE "project_additions" ADD COLUMN IF NOT EXISTS "created_by" uuid;
--> statement-breakpoint
ALTER TABLE "project_additions" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "lead_id" uuid;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "client_id" uuid;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "customer_id" uuid;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "name" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "designer_ids" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "total_contract_paise" bigint;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "gst_pct" smallint DEFAULT 18 NOT NULL;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "handover_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "lifecycle_stage" "project_stage" DEFAULT 'design_pending' NOT NULL;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "timeline_json" jsonb;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "started_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "expected_end_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "client_portal_token" text;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "project_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "vendor_id" uuid;
--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "po_number" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "lines_json" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "status" "po_status" DEFAULT 'draft' NOT NULL;
--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "advance_paid_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "expected_delivery_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "pdf_url" text;
--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "wa_message_id" text;
--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "vendor_phone" text;
--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "vendor_contact_name" text;
--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "quote_lines" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "quote_lines" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "quote_lines" ADD COLUMN IF NOT EXISTS "quote_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "quote_lines" ADD COLUMN IF NOT EXISTS "room" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "quote_lines" ADD COLUMN IF NOT EXISTS "item" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "quote_lines" ADD COLUMN IF NOT EXISTS "description" text;
--> statement-breakpoint
ALTER TABLE "quote_lines" ADD COLUMN IF NOT EXISTS "qty" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "quote_lines" ADD COLUMN IF NOT EXISTS "unit" text DEFAULT 'nos' NOT NULL;
--> statement-breakpoint
ALTER TABLE "quote_lines" ADD COLUMN IF NOT EXISTS "client_rate_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "quote_lines" ADD COLUMN IF NOT EXISTS "cost_rate_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "quote_lines" ADD COLUMN IF NOT EXISTS "margin_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "quote_lines" ADD COLUMN IF NOT EXISTS "hsn_sac" text;
--> statement-breakpoint
ALTER TABLE "quote_lines" ADD COLUMN IF NOT EXISTS "finish" text;
--> statement-breakpoint
ALTER TABLE "quote_lines" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "quote_lines" ADD COLUMN IF NOT EXISTS "material_id" uuid;
--> statement-breakpoint
ALTER TABLE "quote_lines" ADD COLUMN IF NOT EXISTS "section_id" uuid;
--> statement-breakpoint
ALTER TABLE "quote_lines" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "quote_sections" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "quote_sections" ADD COLUMN IF NOT EXISTS "quote_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "quote_sections" ADD COLUMN IF NOT EXISTS "room" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "quote_sections" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "quote_sections" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "project_id" uuid;
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "lead_id" uuid;
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "parent_quote_id" uuid;
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'draft' NOT NULL;
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "quote_number" text;
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "subtotal_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "discount_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "gst_pct" integer DEFAULT 18 NOT NULL;
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "gst_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "total_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "margin_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "pdf_url" text;
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "terms_text" text;
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "valid_until" date;
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "payment_terms" text;
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "sent_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "approved_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "accepted_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "approval_audit_json" jsonb;
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "wa_message_id" text;
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "created_by" uuid;
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN IF NOT EXISTS "lead_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN IF NOT EXISTS "rooms_json" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN IF NOT EXISTS "style_tags" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN IF NOT EXISTS "budget_band" text;
--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN IF NOT EXISTS "moodboard_urls" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN IF NOT EXISTS "total_area_sqft" integer;
--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN IF NOT EXISTS "notes" text;
--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN IF NOT EXISTS "customer_id" uuid;
--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN IF NOT EXISTS "project_id" uuid;
--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN IF NOT EXISTS "issue" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN IF NOT EXISTS "photo_url" text;
--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN IF NOT EXISTS "priority" "service_request_priority" DEFAULT 'medium' NOT NULL;
--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN IF NOT EXISTS "status" "service_request_status" DEFAULT 'open' NOT NULL;
--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN IF NOT EXISTS "assigned_to" uuid;
--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN IF NOT EXISTS "scheduled_visit_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN IF NOT EXISTS "resolved_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN IF NOT EXISTS "notes" text;
--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "user_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "token" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone NOT NULL;
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "ip_address" text;
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "user_agent" text;
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "site_logs" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "site_logs" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "site_logs" ADD COLUMN IF NOT EXISTS "project_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "site_logs" ADD COLUMN IF NOT EXISTS "log_date" date NOT NULL;
--> statement-breakpoint
ALTER TABLE "site_logs" ADD COLUMN IF NOT EXISTS "photos" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
ALTER TABLE "site_logs" ADD COLUMN IF NOT EXISTS "voice_note_url" text;
--> statement-breakpoint
ALTER TABLE "site_logs" ADD COLUMN IF NOT EXISTS "transcript" text;
--> statement-breakpoint
ALTER TABLE "site_logs" ADD COLUMN IF NOT EXISTS "progress_pct" integer;
--> statement-breakpoint
ALTER TABLE "site_logs" ADD COLUMN IF NOT EXISTS "stage" text;
--> statement-breakpoint
ALTER TABLE "site_logs" ADD COLUMN IF NOT EXISTS "activity_type" text;
--> statement-breakpoint
ALTER TABLE "site_logs" ADD COLUMN IF NOT EXISTS "delay_flag" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "site_logs" ADD COLUMN IF NOT EXISTS "labour_count" integer;
--> statement-breakpoint
ALTER TABLE "site_logs" ADD COLUMN IF NOT EXISTS "blockers_json" jsonb;
--> statement-breakpoint
ALTER TABLE "site_logs" ADD COLUMN IF NOT EXISTS "ai_parsed_json" jsonb;
--> statement-breakpoint
ALTER TABLE "site_logs" ADD COLUMN IF NOT EXISTS "source" "site_log_source" DEFAULT 'manual' NOT NULL;
--> statement-breakpoint
ALTER TABLE "site_logs" ADD COLUMN IF NOT EXISTS "log_number" text;
--> statement-breakpoint
ALTER TABLE "site_logs" ADD COLUMN IF NOT EXISTS "follow_up_actions" text;
--> statement-breakpoint
ALTER TABLE "site_logs" ADD COLUMN IF NOT EXISTS "attachments" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
ALTER TABLE "site_logs" ADD COLUMN IF NOT EXISTS "related_work_order_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL;
--> statement-breakpoint
ALTER TABLE "site_logs" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "lead_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "project_id" uuid;
--> statement-breakpoint
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "designer_id" uuid;
--> statement-breakpoint
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "status" "site_visit_status" DEFAULT 'scheduled' NOT NULL;
--> statement-breakpoint
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "purpose" "site_visit_purpose";
--> statement-breakpoint
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "visit_number" text;
--> statement-breakpoint
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "scheduled_at" timestamp with time zone NOT NULL;
--> statement-breakpoint
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "location_json" jsonb;
--> statement-breakpoint
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "photos" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "measurements_json" jsonb;
--> statement-breakpoint
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "voice_notes" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "notes" text;
--> statement-breakpoint
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "follow_up_notes" text;
--> statement-breakpoint
ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "snag_items" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "snag_items" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "snag_items" ADD COLUMN IF NOT EXISTS "project_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "snag_items" ADD COLUMN IF NOT EXISTS "description" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "snag_items" ADD COLUMN IF NOT EXISTS "photo_url" text;
--> statement-breakpoint
ALTER TABLE "snag_items" ADD COLUMN IF NOT EXISTS "assignee_id" uuid;
--> statement-breakpoint
ALTER TABLE "snag_items" ADD COLUMN IF NOT EXISTS "status" "snag_status" DEFAULT 'open' NOT NULL;
--> statement-breakpoint
ALTER TABLE "snag_items" ADD COLUMN IF NOT EXISTS "client_confirmed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "snag_items" ADD COLUMN IF NOT EXISTS "wa_message_id" text;
--> statement-breakpoint
ALTER TABLE "snag_items" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "staff_day_logs" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "staff_day_logs" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "staff_day_logs" ADD COLUMN IF NOT EXISTS "user_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "staff_day_logs" ADD COLUMN IF NOT EXISTS "project_id" uuid;
--> statement-breakpoint
ALTER TABLE "staff_day_logs" ADD COLUMN IF NOT EXISTS "week_start" date NOT NULL;
--> statement-breakpoint
ALTER TABLE "staff_day_logs" ADD COLUMN IF NOT EXISTS "days" numeric(3, 1) NOT NULL;
--> statement-breakpoint
ALTER TABLE "staff_day_logs" ADD COLUMN IF NOT EXISTS "day_rate_paise" bigint NOT NULL;
--> statement-breakpoint
ALTER TABLE "staff_day_logs" ADD COLUMN IF NOT EXISTS "cost_paise" bigint NOT NULL;
--> statement-breakpoint
ALTER TABLE "staff_day_logs" ADD COLUMN IF NOT EXISTS "created_by" uuid;
--> statement-breakpoint
ALTER TABLE "staff_day_logs" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "title" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending' NOT NULL;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "assigned_to" uuid;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "created_by" uuid;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "related_type" text;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "related_id" uuid;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "due_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "notes" text;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "name" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "gstin" text;
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "branding_json" jsonb;
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "wa_config" jsonb;
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "tally_settings" jsonb;
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "supabase_uid" uuid;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" "user_role" DEFAULT 'designer' NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "full_name" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "photo_url" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "job_title" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "department" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "location" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "employment_type" "employment_type";
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "hire_date" date;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "dob" date;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "manager_id" uuid;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emergency_contact_json" jsonb;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active' NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "salary_paise" integer;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "permissions_json" jsonb DEFAULT '{"canSeeFinance":false,"canCreateQuotes":false,"canSendQuotes":false,"canRaisePO":false,"canRecordPayments":false,"canSeeAllLeads":false}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "vendor_payments" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "vendor_payments" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "vendor_payments" ADD COLUMN IF NOT EXISTS "vendor_id" uuid;
--> statement-breakpoint
ALTER TABLE "vendor_payments" ADD COLUMN IF NOT EXISTS "purchase_order_id" uuid;
--> statement-breakpoint
ALTER TABLE "vendor_payments" ADD COLUMN IF NOT EXISTS "expense_id" uuid;
--> statement-breakpoint
ALTER TABLE "vendor_payments" ADD COLUMN IF NOT EXISTS "amount_paise" bigint NOT NULL;
--> statement-breakpoint
ALTER TABLE "vendor_payments" ADD COLUMN IF NOT EXISTS "paid_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "vendor_payments" ADD COLUMN IF NOT EXISTS "method" text;
--> statement-breakpoint
ALTER TABLE "vendor_payments" ADD COLUMN IF NOT EXISTS "reference" text;
--> statement-breakpoint
ALTER TABLE "vendor_payments" ADD COLUMN IF NOT EXISTS "note" text;
--> statement-breakpoint
ALTER TABLE "vendor_payments" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "name" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "phone" text;
--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "email" text;
--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "gstin" text;
--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "category" "material_category";
--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "address" text;
--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "notes" text;
--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "verifications" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "verifications" ADD COLUMN IF NOT EXISTS "identifier" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "verifications" ADD COLUMN IF NOT EXISTS "value" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "verifications" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone NOT NULL;
--> statement-breakpoint
ALTER TABLE "verifications" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "verifications" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "wa_messages" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "wa_messages" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "wa_messages" ADD COLUMN IF NOT EXISTS "lead_id" uuid;
--> statement-breakpoint
ALTER TABLE "wa_messages" ADD COLUMN IF NOT EXISTS "thread_id" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "wa_messages" ADD COLUMN IF NOT EXISTS "meta_message_id" text;
--> statement-breakpoint
ALTER TABLE "wa_messages" ADD COLUMN IF NOT EXISTS "direction" "message_direction" NOT NULL;
--> statement-breakpoint
ALTER TABLE "wa_messages" ADD COLUMN IF NOT EXISTS "category" "message_category";
--> statement-breakpoint
ALTER TABLE "wa_messages" ADD COLUMN IF NOT EXISTS "template_name" text;
--> statement-breakpoint
ALTER TABLE "wa_messages" ADD COLUMN IF NOT EXISTS "body_preview" text;
--> statement-breakpoint
ALTER TABLE "wa_messages" ADD COLUMN IF NOT EXISTS "flow_response_json" jsonb;
--> statement-breakpoint
ALTER TABLE "wa_messages" ADD COLUMN IF NOT EXISTS "cost_paise" integer;
--> statement-breakpoint
ALTER TABLE "wa_messages" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "work_order_updates" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "work_order_updates" ADD COLUMN IF NOT EXISTS "work_order_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "work_order_updates" ADD COLUMN IF NOT EXISTS "progress_pct" integer;
--> statement-breakpoint
ALTER TABLE "work_order_updates" ADD COLUMN IF NOT EXISTS "note" text;
--> statement-breakpoint
ALTER TABLE "work_order_updates" ADD COLUMN IF NOT EXISTS "photos" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
ALTER TABLE "work_order_updates" ADD COLUMN IF NOT EXISTS "created_by" uuid;
--> statement-breakpoint
ALTER TABLE "work_order_updates" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "project_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "quote_line_id" uuid;
--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "title" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "type" "work_order_type" DEFAULT 'site_work' NOT NULL;
--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "priority" "work_order_priority" DEFAULT 'normal' NOT NULL;
--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "description" text;
--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "room" text;
--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "assigned_user_id" uuid;
--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "assigned_vendor_id" uuid;
--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "start_date" date;
--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "due_date" date;
--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "status" "work_order_status" DEFAULT 'draft' NOT NULL;
--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "estimated_cost_paise" bigint DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "actual_cost_paise" bigint DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "materials_json" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "attachments" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "notes" text;
--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "work_order_number" text;
--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "ai_actions" ADD CONSTRAINT "ai_actions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "ai_actions" ADD CONSTRAINT "ai_actions_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "ai_actions" ADD CONSTRAINT "ai_actions_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_marked_by_users_id_fk" FOREIGN KEY ("marked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "civil_branches" ADD CONSTRAINT "civil_branches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "civil_branches" ADD CONSTRAINT "civil_branches_company_id_civil_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."civil_companies"("id") ON DELETE restrict ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "civil_branches" ADD CONSTRAINT "civil_branches_city_id_civil_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."civil_cities"("id") ON DELETE restrict ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "civil_cities" ADD CONSTRAINT "civil_cities_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "civil_companies" ADD CONSTRAINT "civil_companies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "civil_job_costs" ADD CONSTRAINT "civil_job_costs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "civil_job_costs" ADD CONSTRAINT "civil_job_costs_job_id_civil_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."civil_jobs"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "civil_job_events" ADD CONSTRAINT "civil_job_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "civil_job_events" ADD CONSTRAINT "civil_job_events_job_id_civil_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."civil_jobs"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "civil_job_events" ADD CONSTRAINT "civil_job_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "civil_job_lines" ADD CONSTRAINT "civil_job_lines_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "civil_job_lines" ADD CONSTRAINT "civil_job_lines_job_id_civil_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."civil_jobs"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "civil_jobs" ADD CONSTRAINT "civil_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "civil_jobs" ADD CONSTRAINT "civil_jobs_branch_id_civil_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."civil_branches"("id") ON DELETE restrict ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "civil_jobs" ADD CONSTRAINT "civil_jobs_manager_id_civil_managers_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."civil_managers"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "civil_jobs" ADD CONSTRAINT "civil_jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "civil_managers" ADD CONSTRAINT "civil_managers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "client_tokens" ADD CONSTRAINT "client_tokens_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "client_tokens" ADD CONSTRAINT "client_tokens_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "customer_activities" ADD CONSTRAINT "customer_activities_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "customer_activities" ADD CONSTRAINT "customer_activities_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "customer_activities" ADD CONSTRAINT "customer_activities_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "customers" ADD CONSTRAINT "customers_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "customers" ADD CONSTRAINT "customers_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "deliverable_comments" ADD CONSTRAINT "deliverable_comments_deliverable_id_design_deliverables_id_fk" FOREIGN KEY ("deliverable_id") REFERENCES "public"."design_deliverables"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "deliverable_comments" ADD CONSTRAINT "deliverable_comments_version_id_deliverable_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."deliverable_versions"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "deliverable_comments" ADD CONSTRAINT "deliverable_comments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "deliverable_versions" ADD CONSTRAINT "deliverable_versions_deliverable_id_design_deliverables_id_fk" FOREIGN KEY ("deliverable_id") REFERENCES "public"."design_deliverables"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "deliverable_versions" ADD CONSTRAINT "deliverable_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "design_deliverables" ADD CONSTRAINT "design_deliverables_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "design_deliverables" ADD CONSTRAINT "design_deliverables_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "design_deliverables" ADD CONSTRAINT "design_deliverables_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "design_deliverables" ADD CONSTRAINT "design_deliverables_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "design_tasks" ADD CONSTRAINT "design_tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "design_tasks" ADD CONSTRAINT "design_tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "documents" ADD CONSTRAINT "documents_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "expenses" ADD CONSTRAINT "expenses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "expenses" ADD CONSTRAINT "expenses_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "expenses" ADD CONSTRAINT "expenses_logged_by_users_id_fk" FOREIGN KEY ("logged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "expenses" ADD CONSTRAINT "expenses_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "expenses" ADD CONSTRAINT "expenses_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "expenses" ADD CONSTRAINT "expenses_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "grns" ADD CONSTRAINT "grns_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "grns" ADD CONSTRAINT "grns_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "grns" ADD CONSTRAINT "grns_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "lead_follow_ups" ADD CONSTRAINT "lead_follow_ups_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "lead_follow_ups" ADD CONSTRAINT "lead_follow_ups_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "lead_follow_ups" ADD CONSTRAINT "lead_follow_ups_rescheduled_from_id_lead_follow_ups_id_fk" FOREIGN KEY ("rescheduled_from_id") REFERENCES "public"."lead_follow_ups"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "lead_follow_ups" ADD CONSTRAINT "lead_follow_ups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "lead_follow_ups" ADD CONSTRAINT "lead_follow_ups_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "leads" ADD CONSTRAINT "leads_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "leads" ADD CONSTRAINT "leads_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "leads" ADD CONSTRAINT "leads_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "ledger_adjustments" ADD CONSTRAINT "ledger_adjustments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "ledger_adjustments" ADD CONSTRAINT "ledger_adjustments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "ledger_adjustments" ADD CONSTRAINT "ledger_adjustments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "ledger_adjustments" ADD CONSTRAINT "ledger_adjustments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "materials" ADD CONSTRAINT "materials_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "materials" ADD CONSTRAINT "materials_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "measurement_items" ADD CONSTRAINT "measurement_items_round_id_measurement_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."measurement_rounds"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "measurement_rounds" ADD CONSTRAINT "measurement_rounds_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "measurement_rounds" ADD CONSTRAINT "measurement_rounds_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "measurement_rounds" ADD CONSTRAINT "measurement_rounds_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "measurement_rounds" ADD CONSTRAINT "measurement_rounds_site_visit_id_site_visits_id_fk" FOREIGN KEY ("site_visit_id") REFERENCES "public"."site_visits"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "measurement_rounds" ADD CONSTRAINT "measurement_rounds_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "measurement_rounds" ADD CONSTRAINT "measurement_rounds_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "milestones" ADD CONSTRAINT "milestones_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "milestones" ADD CONSTRAINT "milestones_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "payments" ADD CONSTRAINT "payments_manual_override_by_users_id_fk" FOREIGN KEY ("manual_override_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "payments" ADD CONSTRAINT "payments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "payslips" ADD CONSTRAINT "payslips_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "payslips" ADD CONSTRAINT "payslips_run_id_payroll_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "payslips" ADD CONSTRAINT "payslips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "project_additions" ADD CONSTRAINT "project_additions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "project_additions" ADD CONSTRAINT "project_additions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "project_additions" ADD CONSTRAINT "project_additions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "projects" ADD CONSTRAINT "projects_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "projects" ADD CONSTRAINT "projects_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "projects" ADD CONSTRAINT "projects_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_section_id_quote_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."quote_sections"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "quote_sections" ADD CONSTRAINT "quote_sections_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "quotes" ADD CONSTRAINT "quotes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "quotes" ADD CONSTRAINT "quotes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "quotes" ADD CONSTRAINT "quotes_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "quotes" ADD CONSTRAINT "quotes_parent_quote_id_quotes_id_fk" FOREIGN KEY ("parent_quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "quotes" ADD CONSTRAINT "quotes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "requirements" ADD CONSTRAINT "requirements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "requirements" ADD CONSTRAINT "requirements_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "site_logs" ADD CONSTRAINT "site_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "site_logs" ADD CONSTRAINT "site_logs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_designer_id_users_id_fk" FOREIGN KEY ("designer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "snag_items" ADD CONSTRAINT "snag_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "snag_items" ADD CONSTRAINT "snag_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "snag_items" ADD CONSTRAINT "snag_items_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "staff_day_logs" ADD CONSTRAINT "staff_day_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "staff_day_logs" ADD CONSTRAINT "staff_day_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "staff_day_logs" ADD CONSTRAINT "staff_day_logs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "staff_day_logs" ADD CONSTRAINT "staff_day_logs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "tasks" ADD CONSTRAINT "tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "vendors" ADD CONSTRAINT "vendors_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "wa_messages" ADD CONSTRAINT "wa_messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "wa_messages" ADD CONSTRAINT "wa_messages_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "work_order_updates" ADD CONSTRAINT "work_order_updates_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "work_order_updates" ADD CONSTRAINT "work_order_updates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_quote_line_id_quote_lines_id_fk" FOREIGN KEY ("quote_line_id") REFERENCES "public"."quote_lines"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_assigned_vendor_id_vendors_id_fk" FOREIGN KEY ("assigned_vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounts_user_idx" ON "accounts" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_actions_tenant_idx" ON "ai_actions" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_actions_requested_by_idx" ON "ai_actions" USING btree ("requested_by");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attendance_tenant_date_idx" ON "attendance_records" USING btree ("tenant_id","date");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_user_date_idx" ON "attendance_records" USING btree ("user_id","date");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "civil_branches_company_city_name_uq" ON "civil_branches" USING btree ("company_id","city_id",lower("name"));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "civil_branches_tenant_idx" ON "civil_branches" USING btree ("tenant_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "civil_cities_tenant_name_uq" ON "civil_cities" USING btree ("tenant_id",lower("name"));
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "civil_companies_tenant_name_uq" ON "civil_companies" USING btree ("tenant_id",lower("name"));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "civil_job_costs_job_idx" ON "civil_job_costs" USING btree ("job_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "civil_job_events_job_idx" ON "civil_job_events" USING btree ("job_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "civil_job_lines_job_idx" ON "civil_job_lines" USING btree ("job_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "civil_jobs_tenant_job_no_uq" ON "civil_jobs" USING btree ("tenant_id","job_no");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "civil_jobs_tenant_status_idx" ON "civil_jobs" USING btree ("tenant_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "civil_jobs_branch_idx" ON "civil_jobs" USING btree ("branch_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "civil_managers_tenant_name_uq" ON "civil_managers" USING btree ("tenant_id",lower("name"));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "client_tokens_token_idx" ON "client_tokens" USING btree ("token");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "client_tokens_project_idx" ON "client_tokens" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_activities_customer_idx" ON "customer_activities" USING btree ("customer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_activities_tenant_type_idx" ON "customer_activities" USING btree ("tenant_id","type");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customers_tenant_phone_unique" ON "customers" USING btree ("tenant_id","phone");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_tenant_stage_idx" ON "customers" USING btree ("tenant_id","stage");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_tenant_owner_idx" ON "customers" USING btree ("tenant_id","owner_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deliverable_comments_deliverable_idx" ON "deliverable_comments" USING btree ("deliverable_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deliverable_versions_deliverable_idx" ON "deliverable_versions" USING btree ("deliverable_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "design_deliverables_lead_idx" ON "design_deliverables" USING btree ("lead_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "design_deliverables_project_idx" ON "design_deliverables" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "design_tasks_tenant_status_idx" ON "design_tasks" USING btree ("tenant_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "design_tasks_tenant_project_idx" ON "design_tasks" USING btree ("tenant_id","project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_tenant_parent_idx" ON "documents" USING btree ("tenant_id","parent_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_tenant_starred_idx" ON "documents" USING btree ("tenant_id","starred");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_due_date_idx" ON "expenses" USING btree ("due_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_po_id_idx" ON "expenses" USING btree ("po_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_status_tenant_idx" ON "invoices" USING btree ("tenant_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_due_date_idx" ON "invoices" USING btree ("due_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_activities_tenant_lead_idx" ON "lead_activities" USING btree ("tenant_id","lead_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_follow_ups_lead_idx" ON "lead_follow_ups" USING btree ("lead_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_follow_ups_tenant_lead_idx" ON "lead_follow_ups" USING btree ("tenant_id","lead_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_tenant_stage_idx" ON "leads" USING btree ("tenant_id","stage");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_tenant_owner_idx" ON "leads" USING btree ("tenant_id","owner_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_customer_idx" ON "leads" USING btree ("customer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leave_requests_tenant_idx" ON "leave_requests" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leave_requests_user_idx" ON "leave_requests" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leave_requests_status_idx" ON "leave_requests" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_adjustments_customer_idx" ON "ledger_adjustments" USING btree ("tenant_id","customer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "measurement_items_round_idx" ON "measurement_items" USING btree ("round_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "measurement_rounds_lead_idx" ON "measurement_rounds" USING btree ("lead_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "measurement_rounds_tenant_idx" ON "measurement_rounds" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_tenant_read_idx" ON "notifications" USING btree ("tenant_id","read_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_allocations_payment_idx" ON "payment_allocations" USING btree ("payment_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_allocations_milestone_idx" ON "payment_allocations" USING btree ("milestone_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_received_at_tenant_idx" ON "payments" USING btree ("tenant_id","received_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_customer_idx" ON "payments" USING btree ("customer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payroll_runs_tenant_idx" ON "payroll_runs" USING btree ("tenant_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_runs_tenant_month_uq" ON "payroll_runs" USING btree ("tenant_id","month");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payslips_run_idx" ON "payslips" USING btree ("run_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payslips_tenant_idx" ON "payslips" USING btree ("tenant_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payslips_run_user_uq" ON "payslips" USING btree ("run_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "portfolios_tenant_idx" ON "portfolios" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_additions_project_idx" ON "project_additions" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_tenant_stage_idx" ON "projects" USING btree ("tenant_id","lifecycle_stage");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quote_sections_quote_idx" ON "quote_sections" USING btree ("quote_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_requests_tenant_status_idx" ON "service_requests" USING btree ("tenant_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_user_idx" ON "sessions" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staff_day_logs_project_idx" ON "staff_day_logs" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_tenant_assigned_idx" ON "tasks" USING btree ("tenant_id","assigned_to");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_tenant_status_idx" ON "tasks" USING btree ("tenant_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendor_payments_tenant_idx" ON "vendor_payments" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendor_payments_vendor_idx" ON "vendor_payments" USING btree ("vendor_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendor_payments_expense_id_idx" ON "vendor_payments" USING btree ("expense_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vendor_payments_po_ref_uq" ON "vendor_payments" USING btree ("purchase_order_id","reference") WHERE reference IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendors_tenant_idx" ON "vendors" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verifications_identifier_idx" ON "verifications" USING btree ("identifier");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wa_messages_tenant_thread_idx" ON "wa_messages" USING btree ("tenant_id","thread_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wa_messages_lead_idx" ON "wa_messages" USING btree ("lead_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "work_order_updates_wo_idx" ON "work_order_updates" USING btree ("work_order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "work_orders_tenant_project_idx" ON "work_orders" USING btree ("tenant_id","project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "work_orders_status_idx" ON "work_orders" USING btree ("status");
