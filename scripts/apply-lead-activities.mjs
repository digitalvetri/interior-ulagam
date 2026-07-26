import postgres from 'postgres';
import { config } from 'dotenv';

config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

const ddl = `
do $$ begin
  create type lead_activity_type as enum ('call','whatsapp','note','site_visit','meeting','stage_change','follow_up');
exception when duplicate_object then null; end $$;

do $$ begin
  create type follow_up_status as enum ('pending','completed','overdue','rescheduled','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists lead_activities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  type lead_activity_type not null,
  title text not null,
  description text,
  scheduled_at timestamptz,
  completed_at timestamptz,
  status follow_up_status,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create index if not exists lead_activities_tenant_lead_idx on lead_activities (tenant_id, lead_id);

alter table lead_activities enable row level security;

do $$ begin
  create policy "tenant_isolation" on lead_activities
    using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
    with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
exception when duplicate_object then null; end $$;
`;

try {
  await sql.unsafe(ddl);
  console.log('lead_activities table + enums + RLS applied.');
} catch (err) {
  console.error('Failed:', err.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
