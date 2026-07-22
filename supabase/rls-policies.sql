-- Run this in Supabase SQL Editor after drizzle-kit push
-- Enable RLS on all tenant-scoped tables

alter table tenants enable row level security;
alter table users enable row level security;
alter table leads enable row level security;
alter table site_visits enable row level security;
alter table requirements enable row level security;
alter table projects enable row level security;
alter table quotes enable row level security;
alter table quote_lines enable row level security;
alter table deliverables enable row level security;
alter table milestones enable row level security;
alter table site_logs enable row level security;
alter table purchase_orders enable row level security;
alter table grns enable row level security;
alter table materials enable row level security;
alter table invoices enable row level security;
alter table payments enable row level security;
alter table expenses enable row level security;
alter table snag_items enable row level security;
alter table wa_messages enable row level security;

-- Tenant isolation policy template (repeat for each table)
-- Requires tenant_id claim in JWT: { "tenant_id": "uuid" }

create policy "tenant_isolation" on tenants
  using (id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "tenant_isolation" on users
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "tenant_isolation" on leads
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "tenant_isolation" on site_visits
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "tenant_isolation" on requirements
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "tenant_isolation" on projects
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "tenant_isolation" on quotes
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "tenant_isolation" on materials
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "tenant_isolation" on invoices
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "tenant_isolation" on payments
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "tenant_isolation" on site_logs
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "tenant_isolation" on purchase_orders
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "tenant_isolation" on grns
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "tenant_isolation" on expenses
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "tenant_isolation" on wa_messages
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- quote_lines: isolation via join to quotes
create policy "tenant_isolation" on quote_lines
  using (
    exists (
      select 1 from quotes q
      where q.id = quote_lines.quote_id
        and q.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

-- deliverables: isolation via join to projects
create policy "tenant_isolation" on deliverables
  using (
    exists (
      select 1 from projects p
      where p.id = deliverables.project_id
        and p.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

-- milestones: via projects
create policy "tenant_isolation" on milestones
  using (
    exists (
      select 1 from projects p
      where p.id = milestones.project_id
        and p.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

-- snag_items: via projects
create policy "tenant_isolation" on snag_items
  using (
    exists (
      select 1 from projects p
      where p.id = snag_items.project_id
        and p.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );
