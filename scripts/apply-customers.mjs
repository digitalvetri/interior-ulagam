import postgres from 'postgres';
import { config } from 'dotenv';

config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

const ddl = `
do $$ begin
  create type customer_source as enum ('referral','instagram','whatsapp','website','walk_in','imported','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type customer_stage as enum ('lead','opportunity','client','past_client');
exception when duplicate_object then null; end $$;

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  owner_id uuid references users(id),
  full_name text not null,
  email text,
  phone text not null,
  company text,
  city text,
  address text,
  source customer_source not null default 'other',
  stage customer_stage not null default 'lead',
  tags text[] not null default '{}'::text[],
  notes text,
  last_contacted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists customers_tenant_stage_idx on customers (tenant_id, stage);
create index if not exists customers_tenant_owner_idx on customers (tenant_id, owner_id);

alter table customers enable row level security;

drop policy if exists "tenant_isolation" on customers;
create policy "tenant_isolation" on customers
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
`;

try {
  await sql.unsafe(ddl);
  console.log('customers table + enums + RLS applied.');
} catch (err) {
  console.error('Failed:', err.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
