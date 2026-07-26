import postgres from 'postgres';
import { config } from 'dotenv';

config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

// Tables whose RLS uses tenant_id directly
const tenantScopedTables = [
  'users', 'leads', 'site_visits', 'requirements', 'projects', 'quotes',
  'materials', 'invoices', 'payments', 'site_logs', 'purchase_orders',
  'grns', 'expenses', 'wa_messages', 'lead_activities',
];

// Tables whose RLS joins to a parent table
const joinedTables = [
  { table: 'quote_lines',  parent: 'quotes',   fk: 'quote_id'   },
  { table: 'deliverables', parent: 'projects', fk: 'project_id' },
  { table: 'milestones',   parent: 'projects', fk: 'project_id' },
  { table: 'snag_items',   parent: 'projects', fk: 'project_id' },
];

let ddl = `
-- Resolve the caller's tenant_id from the users table via their Supabase auth uid.
-- SECURITY DEFINER so it can bypass RLS on public.users when reading its own row.
create or replace function public.current_tenant_id()
  returns uuid
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select tenant_id from public.users where supabase_uid = auth.uid() limit 1
$$;

grant execute on function public.current_tenant_id() to authenticated, anon;

-- tenants: id = current_tenant_id()
drop policy if exists "tenant_isolation" on tenants;
create policy "tenant_isolation" on tenants
  using (id = public.current_tenant_id());
`;

for (const t of tenantScopedTables) {
  ddl += `
drop policy if exists "tenant_isolation" on ${t};
create policy "tenant_isolation" on ${t}
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
`;
}

for (const j of joinedTables) {
  ddl += `
drop policy if exists "tenant_isolation" on ${j.table};
create policy "tenant_isolation" on ${j.table}
  using (
    exists (
      select 1 from ${j.parent} p
      where p.id = ${j.table}.${j.fk}
        and p.tenant_id = public.current_tenant_id()
    )
  );
`;
}

try {
  await sql.unsafe(ddl);
  console.log('current_tenant_id() installed; all RLS policies rewritten to use it.');
} catch (err) {
  console.error('Failed:', err.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
