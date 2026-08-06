import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  smallint,
  bigint,
  jsonb,
  pgEnum,
  date,
  index,
} from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', ['owner', 'designer', 'supervisor', 'accountant']);

export const leadStageEnum = pgEnum('lead_stage', [
  'new', 'site_visit_scheduled', 'consultation_done',
  'proposal_sent', 'negotiation', 'won', 'lost',
]);

export const leadSourceEnum = pgEnum('lead_source', [
  'instagram', 'whatsapp', 'referral', 'website', 'walk_in', 'other',
]);

export const projectStageEnum = pgEnum('project_stage', [
  'design_pending', 'design_in_progress', 'design_approved',
  'procurement', 'execution', 'snagging', 'handover', 'complete',
]);

export const deliverableTypeEnum = pgEnum('deliverable_type', [
  '2d_plan', '3d_render', 'color_palette', 'working_drawings', 'bom',
]);

export const deliverableStatusEnum = pgEnum('deliverable_status', [
  'pending', 'in_progress', 'in_review', 'approved', 'rejected',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending', 'link_sent', 'paid', 'overdue',
]);

export const poStatusEnum = pgEnum('po_status', [
  'draft', 'sent', 'acknowledged', 'partial', 'complete', 'cancelled',
]);

export const messageDirectionEnum = pgEnum('message_direction', ['inbound', 'outbound']);
export const messageCategoryEnum = pgEnum('message_category', ['utility', 'marketing', 'service']);
export const expenseCategoryEnum = pgEnum('expense_category', [
  'petty_cash', 'transport', 'labour', 'material', 'other',
]);
export const snagStatusEnum = pgEnum('snag_status', [
  'open', 'in_progress', 'resolved', 'client_confirmed',
]);
export const materialCategoryEnum = pgEnum('material_category', [
  'laminate', 'hardware', 'furniture', 'fabric', 'lighting', 'flooring', 'sanitary', 'other',
]);
export const siteLogSourceEnum = pgEnum('site_log_source', ['whatsapp', 'manual']);

export const documentKindEnum = pgEnum('document_kind', ['folder', 'file']);

export const employmentTypeEnum = pgEnum('employment_type', [
  'full_time', 'part_time', 'contract', 'intern', 'consultant',
]);

export const notificationSeverityEnum = pgEnum('notification_severity', [
  'info', 'success', 'warning', 'critical',
]);

export const designTaskStatusEnum = pgEnum('design_task_status', [
  'todo', 'in_progress', 'review', 'done',
]);
export const designTaskPriorityEnum = pgEnum('design_task_priority', [
  'low', 'normal', 'high', 'urgent',
]);

export const customerSourceEnum = pgEnum('customer_source', [
  'referral', 'instagram', 'whatsapp', 'website', 'walk_in', 'imported', 'other',
]);
export const customerStageEnum = pgEnum('customer_stage', [
  'lead', 'opportunity', 'client', 'past_client',
]);

export const leadPriorityEnum = pgEnum('lead_priority', ['hot', 'warm', 'cold']);

export const leadActivityTypeEnum = pgEnum('lead_activity_type', [
  'call', 'whatsapp', 'note', 'site_visit', 'meeting', 'stage_change', 'follow_up',
]);
export const followUpStatusEnum = pgEnum('follow_up_status', [
  'pending', 'completed', 'overdue', 'rescheduled', 'cancelled',
]);

export const customerActivityTypeEnum = pgEnum('customer_activity_type', [
  'call', 'whatsapp', 'note', 'site_visit', 'meeting',
  'stage_change', 'project_created', 'payment_received', 'quote_sent', 'follow_up',
]);

export const customerHealthStatusEnum = pgEnum('customer_health_status', [
  'hot', 'healthy', 'at_risk', 'inactive',
]);

// ─── Shared ───────────────────────────────────────────────────────────────────

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
};

// ─── Tables ───────────────────────────────────────────────────────────────────

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  gstin: text('gstin'),
  brandingJson: jsonb('branding_json'),
  waConfig: jsonb('wa_config'),
  tallySettings: jsonb('tally_settings'),
  ...timestamps,
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  supabaseUid: uuid('supabase_uid').unique(),
  role: userRoleEnum('role').notNull().default('designer'),
  fullName: text('full_name').notNull(),
  phone: text('phone'),
  // Deliberately nullable: not every employee is a login. Postgres permits
  // many NULLs under a UNIQUE index, so staff without an email simply have no
  // way to authenticate, while Better Auth still gets the uniqueness it needs.
  email: text('email').unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  // ── HR extended fields (employees module) ─────────────────
  photoUrl: text('photo_url'),
  jobTitle: text('job_title'),
  department: text('department'),
  location: text('location'),
  employmentType: employmentTypeEnum('employment_type'),
  hireDate: date('hire_date'),
  dob: date('dob'),
  managerId: uuid('manager_id'),                     // self-FK, added via SQL
  emergencyContact: jsonb('emergency_contact_json'), // { name, relation, phone }
  status: text('status').notNull().default('active'), // active | on_leave | inactive
  ...timestamps,
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Auth (Better Auth) ───────────────────────────────────────────────────────
// Better Auth is configured to use `users` above as its user model, so the app
// has exactly one identity per person and the 15 existing FKs to users.id keep
// working. These three tables are Better Auth's own and are not referenced by
// application code.

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  ...timestamps,
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('sessions_user_idx').on(t.userId),
]);

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  // Argon2/scrypt hash for the credential provider; null for OAuth accounts.
  password: text('password'),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  ...timestamps,
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('accounts_user_idx').on(t.userId),
]);

export const verifications = pgTable('verifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ...timestamps,
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('verifications_identifier_idx').on(t.identifier),
]);

export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  // Forward link to the canonical customer record for this contact.
  // Circular FK (customers also has leadId) — lazy callback resolves at runtime.
  customerId: uuid('customer_id').references((): AnyPgColumn => customers.id, { onDelete: 'set null' }),
  source: leadSourceEnum('source').notNull().default('whatsapp'),
  stage: leadStageEnum('stage').notNull().default('new'),
  priority: leadPriorityEnum('priority'),
  ownerId: uuid('owner_id').references(() => users.id),
  contactName: text('contact_name').notNull(),
  contactPhone: text('contact_phone').notNull(),
  alternatePhone: text('alternate_phone'),
  contactEmail: text('contact_email'),
  contactCity: text('contact_city'),
  pincode: text('pincode'),
  propertyType: text('property_type'),
  projectName: text('project_name'),
  projectLocation: text('project_location'),
  budgetBand: text('budget_band'),
  projectValuePaise: bigint('project_value_paise', { mode: 'number' }),
  designerName: text('designer_name'),
  followUpDate: timestamp('follow_up_date', { withTimezone: true }),
  lostReason: text('lost_reason'),
  notes: text('notes'),
  preferredLanguage: text('preferred_language').default('en'),
  score: smallint('score').default(0),
  scoreBreakdown: jsonb('score_breakdown'),
  firstTouchAt: timestamp('first_touch_at', { withTimezone: true }).notNull().defaultNow(),
  lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  index('leads_tenant_stage_idx').on(t.tenantId, t.stage),
  index('leads_tenant_owner_idx').on(t.tenantId, t.ownerId),
  index('leads_customer_idx').on(t.customerId),
]);

export const siteVisits = pgTable('site_visits', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  designerId: uuid('designer_id').references(() => users.id),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  locationJson: jsonb('location_json'),
  photos: text('photos').array().notNull().default(sql`'{}'::text[]`),
  measurementsJson: jsonb('measurements_json'),
  voiceNotes: text('voice_notes').array().notNull().default(sql`'{}'::text[]`),
  notes: text('notes'),
  ...timestamps,
});

export const requirements = pgTable('requirements', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  roomsJson: jsonb('rooms_json').notNull().default(sql`'[]'::jsonb`),
  styleTags: text('style_tags').array().notNull().default(sql`'{}'::text[]`),
  budgetBand: text('budget_band'),
  moodboardUrls: text('moodboard_urls').array().notNull().default(sql`'{}'::text[]`),
  totalAreaSqft: integer('total_area_sqft'),
  notes: text('notes'),
  ...timestamps,
});

export const materials = pgTable('materials', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  category: materialCategoryEnum('category').notNull(),
  name: text('name').notNull(),
  brand: text('brand'),
  vendorId: uuid('vendor_id').references(() => users.id),
  unit: text('unit').notNull().default('nos'),
  currentRatePaise: integer('current_rate_paise').notNull().default(0),
  lastPurchasePricePaise: integer('last_purchase_price_paise'),
  priceHistoryJson: jsonb('price_history_json').notNull().default(sql`'[]'::jsonb`),
  hsnSac: text('hsn_sac'),
  notes: text('notes'),
  ...timestamps,
});

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  leadId: uuid('lead_id').references(() => leads.id),
  clientId: uuid('client_id').references(() => users.id),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  name: text('name').notNull().default(''),
  designerIds: text('designer_ids').array().notNull().default(sql`'{}'::text[]`),
  totalContractPaise: integer('total_contract_paise'),
  lifecycleStage: projectStageEnum('lifecycle_stage').notNull().default('design_pending'),
  timelineJson: jsonb('timeline_json'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  expectedEndAt: timestamp('expected_end_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  index('projects_tenant_stage_idx').on(t.tenantId, t.lifecycleStage),
]);

export const quotes = pgTable('quotes', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
  version: integer('version').notNull().default(1),
  status: text('status').notNull().default('draft'),
  subtotalPaise: integer('subtotal_paise').notNull().default(0),
  gstPaise: integer('gst_paise').notNull().default(0),
  totalPaise: integer('total_paise').notNull().default(0),
  pdfUrl: text('pdf_url'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvalAuditJson: jsonb('approval_audit_json'),
  waMessageId: text('wa_message_id'),
  createdBy: uuid('created_by').references(() => users.id),
  ...timestamps,
});

export const quoteLines = pgTable('quote_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  quoteId: uuid('quote_id').notNull().references(() => quotes.id, { onDelete: 'cascade' }),
  room: text('room').notNull(),
  item: text('item').notNull(),
  description: text('description'),
  qty: integer('qty').notNull().default(1),
  unit: text('unit').notNull().default('nos'),
  clientRatePaise: integer('client_rate_paise').notNull().default(0),
  costRatePaise: integer('cost_rate_paise').notNull().default(0),
  marginPaise: integer('margin_paise').notNull().default(0), // computed by app: (clientRate - costRate) * qty
  hsnSac: text('hsn_sac'),
  materialId: uuid('material_id').references(() => materials.id),
  ...timestamps,
});

export const deliverables = pgTable('deliverables', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  type: deliverableTypeEnum('type').notNull(),
  status: deliverableStatusEnum('status').notNull().default('pending'),
  revisionCount: integer('revision_count').notNull().default(0),
  revisionCap: integer('revision_cap').notNull().default(2),
  latestFileUrl: text('latest_file_url'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  ...timestamps,
});

export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  invoiceNumber: text('invoice_number').notNull(),
  invoiceDate: date('invoice_date').notNull(),
  hsnSacLinesJson: jsonb('hsn_sac_lines_json').notNull().default(sql`'[]'::jsonb`),
  subtotalPaise: integer('subtotal_paise').notNull().default(0),
  cgstPaise: integer('cgst_paise').notNull().default(0),
  sgstPaise: integer('sgst_paise').notNull().default(0),
  igstPaise: integer('igst_paise').notNull().default(0),
  placeOfSupply: text('place_of_supply'),
  isInterstate: boolean('is_interstate').notNull().default(false),
  irn: text('irn'),
  qrCodeUrl: text('qr_code_url'),
  pdfUrl: text('pdf_url'),
  ...timestamps,
});

export const milestones = pgTable('milestones', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  pctOfTotal: integer('pct_of_total').notNull(),
  amountPaise: integer('amount_paise').notNull().default(0),
  triggerStage: projectStageEnum('trigger_stage'),
  invoiceId: uuid('invoice_id').references(() => invoices.id),
  paymentStatus: paymentStatusEnum('payment_status').notNull().default('pending'),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  razorpayLinkId: text('razorpay_link_id'),
  ...timestamps,
});

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  razorpayLinkId: text('razorpay_link_id'),
  razorpayPaymentId: text('razorpay_payment_id').unique(),
  amountPaise: integer('amount_paise').notNull(),
  status: text('status').notNull().default('pending'),
  reconciledAt: timestamp('reconciled_at', { withTimezone: true }),
  manualOverrideBy: uuid('manual_override_by').references(() => users.id),
  manualOverrideNote: text('manual_override_note'),
  ...timestamps,
});

export const siteLogs = pgTable('site_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  logDate: date('log_date').notNull(),
  photos: text('photos').array().notNull().default(sql`'{}'::text[]`),
  voiceNoteUrl: text('voice_note_url'),
  transcript: text('transcript'),
  progressPct: integer('progress_pct'),
  stage: text('stage'),
  delayFlag: boolean('delay_flag').notNull().default(false),
  labourCount: integer('labour_count'),
  blockersJson: jsonb('blockers_json'),
  aiParsedJson: jsonb('ai_parsed_json'),
  source: siteLogSourceEnum('source').notNull().default('manual'),
  ...timestamps,
});

export const purchaseOrders = pgTable('purchase_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  vendorId: uuid('vendor_id').references(() => users.id),
  poNumber: text('po_number').notNull(),
  linesJson: jsonb('lines_json').notNull().default(sql`'[]'::jsonb`),
  status: poStatusEnum('status').notNull().default('draft'),
  advancePaidPaise: integer('advance_paid_paise').notNull().default(0),
  expectedDeliveryAt: timestamp('expected_delivery_at', { withTimezone: true }),
  pdfUrl: text('pdf_url'),
  waMessageId: text('wa_message_id'),
  vendorPhone: text('vendor_phone'),
  vendorContactName: text('vendor_contact_name'),
  ...timestamps,
});

export const grns = pgTable('grns', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  poId: uuid('po_id').notNull().references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  lineId: uuid('line_id'),
  deliveredQty: integer('delivered_qty').notNull(),
  photoProof: text('photo_proof').array().notNull().default(sql`'{}'::text[]`),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  notes: text('notes'),
  ...timestamps,
});

export const expenses = pgTable('expenses', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  category: expenseCategoryEnum('category').notNull(),
  amountPaise: integer('amount_paise').notNull(),
  description: text('description'),
  receiptUrl: text('receipt_url'),
  loggedBy: uuid('logged_by').references(() => users.id),
  loggedVia: text('logged_via').notNull().default('manual'),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  ...timestamps,
});

export const snagItems = pgTable('snag_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  photoUrl: text('photo_url'),
  assigneeId: uuid('assignee_id').references(() => users.id),
  status: snagStatusEnum('status').notNull().default('open'),
  clientConfirmedAt: timestamp('client_confirmed_at', { withTimezone: true }),
  waMessageId: text('wa_message_id'),
  ...timestamps,
});

export const waMessages = pgTable('wa_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
  threadId: text('thread_id').notNull(),
  metaMessageId: text('meta_message_id'),
  direction: messageDirectionEnum('direction').notNull(),
  category: messageCategoryEnum('category'),
  templateName: text('template_name'),
  bodyPreview: text('body_preview'),
  flowResponseJson: jsonb('flow_response_json'),
  costPaise: integer('cost_paise'),
  ...timestamps,
}, (t) => [
  index('wa_messages_tenant_thread_idx').on(t.tenantId, t.threadId),
  index('wa_messages_lead_idx').on(t.leadId),
]);

export const vendors = pgTable('vendors', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  gstin: text('gstin'),
  category: materialCategoryEnum('category'),
  address: text('address'),
  notes: text('notes'),
  ...timestamps,
}, (t) => [
  index('vendors_tenant_idx').on(t.tenantId),
]);

// Secure, revocable, expiring client portal share links.
// The token column is what goes in the URL — a random 32-byte hex string.
export const clientTokens = pgTable('client_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  index('client_tokens_token_idx').on(t.token),
  index('client_tokens_project_idx').on(t.projectId),
]);

// Google-Drive-style hierarchical documents. Folders have kind='folder' and
// storage_path=null. Files have kind='file' and a storage_path pointing at
// an object in the Supabase Storage 'documents' bucket.
// Note: parent_id is self-referential but we don't declare the FK inline
// because Drizzle can't forward-reference the table variable.
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  parentId: uuid('parent_id'),
  kind: documentKindEnum('kind').notNull(),
  name: text('name').notNull(),
  mimeType: text('mime_type'),
  sizeBytes: integer('size_bytes'),
  storagePath: text('storage_path'),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
  uploadedBy: uuid('uploaded_by').references(() => users.id),
  starred: boolean('starred').notNull().default(false),
  ...timestamps,
}, (t) => [
  index('documents_tenant_parent_idx').on(t.tenantId, t.parentId),
  index('documents_tenant_starred_idx').on(t.tenantId, t.starred),
]);

// Internal design-task list for the studio (rendered as /work-orders in UI).
// Interior-design studios don't dispatch to workers — this is their own
// to-do list of design deliverables per project.
// Studio notifications — tenant-wide, optionally targeted to a single user.
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  severity: notificationSeverityEnum('severity').notNull().default('info'),
  title: text('title').notNull(),
  body: text('body'),
  href: text('href'),
  readAt: timestamp('read_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  index('notifications_tenant_read_idx').on(t.tenantId, t.readAt),
]);

export const designTasks = pgTable('design_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description'),
  status: designTaskStatusEnum('status').notNull().default('todo'),
  priority: designTaskPriorityEnum('priority').notNull().default('normal'),
  dueDate: date('due_date'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  index('design_tasks_tenant_status_idx').on(t.tenantId, t.status),
  index('design_tasks_tenant_project_idx').on(t.tenantId, t.projectId),
]);

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  ownerId: uuid('owner_id').references(() => users.id),
  fullName: text('full_name').notNull(),
  email: text('email'),
  phone: text('phone').notNull(),
  company: text('company'),
  city: text('city'),
  address: text('address'),
  source: customerSourceEnum('source').notNull().default('other'),
  stage: customerStageEnum('stage').notNull().default('lead'),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
  tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
  notes: text('notes'),
  lastContactedAt: timestamp('last_contacted_at', { withTimezone: true }),
  healthScore: smallint('health_score'),
  healthStatus: customerHealthStatusEnum('health_status'),
  healthUpdatedAt: timestamp('health_updated_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  index('customers_tenant_stage_idx').on(t.tenantId, t.stage),
  index('customers_tenant_owner_idx').on(t.tenantId, t.ownerId),
]);

export const leadActivities = pgTable('lead_activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  type: leadActivityTypeEnum('type').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  status: followUpStatusEnum('status'),
  createdBy: uuid('created_by').references(() => users.id),
  ...timestamps,
}, (t) => [
  index('lead_activities_tenant_lead_idx').on(t.tenantId, t.leadId),
]);

export const customerActivities = pgTable('customer_activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  type: customerActivityTypeEnum('type').notNull(),
  title: text('title').notNull(),
  body: text('body'),
  metadataJson: jsonb('metadata_json'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  performedBy: uuid('performed_by').references(() => users.id),
  ...timestamps,
}, (t) => [
  index('customer_activities_customer_idx').on(t.customerId),
  index('customer_activities_tenant_type_idx').on(t.tenantId, t.type),
]);

export const portfolios = pgTable('portfolios', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull().default(''),
  coverPhotoUrl: text('cover_photo_url'),
  photos: text('photos').array().notNull().default(sql`'{}'::text[]`),
  isPublic: boolean('is_public').notNull().default(false),
  clientConsent: boolean('client_consent').notNull().default(false),
  aiCuratedJson: jsonb('ai_curated_json'),
  ...timestamps,
}, (t) => [
  index('portfolios_tenant_idx').on(t.tenantId),
]);

export const leadFollowUps = pgTable('lead_follow_ups', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  followUpDate: timestamp('follow_up_date', { withTimezone: true }),
  stage: text('stage').notNull(),
  clientStatus: text('client_status').notNull(),
  comments: text('comments'),
  addToCalendar: boolean('add_to_calendar').notNull().default(true),
  createdBy: uuid('created_by').references(() => users.id),
  updatedBy: uuid('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
}, (t) => [
  index('lead_follow_ups_lead_idx').on(t.leadId),
  index('lead_follow_ups_tenant_lead_idx').on(t.tenantId, t.leadId),
]);
