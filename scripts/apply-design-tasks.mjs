import postgres from 'postgres';
import { config } from 'dotenv';

config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

const ddl = `
do $$ begin
  create type design_task_status as enum ('todo','in_progress','review','done');
exception when duplicate_object then null; end $$;

do $$ begin
  create type design_task_priority as enum ('low','normal','high','urgent');
exception when duplicate_object then null; end $$;

create table if not exists design_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  title text not null,
  description text,
  status design_task_status not null default 'todo',
  priority design_task_priority not null default 'normal',
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists design_tasks_tenant_status_idx on design_tasks (tenant_id, status);
create index if not exists design_tasks_tenant_project_idx on design_tasks (tenant_id, project_id);

alter table design_tasks enable row level security;

drop policy if exists "tenant_isolation" on design_tasks;
create policy "tenant_isolation" on design_tasks
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
`;

try {
  await sql.unsafe(ddl);
  console.log('design_tasks table + RLS applied.');
} catch (err) {
  console.error('Failed:', err.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
