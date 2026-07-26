import postgres from 'postgres';
import { config } from 'dotenv';

config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

const ddl = `
do $$ begin
  create type notification_severity as enum ('info','success','warning','critical');
exception when duplicate_object then null; end $$;

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  severity notification_severity not null default 'info',
  title text not null,
  body text,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_tenant_read_idx on notifications (tenant_id, read_at);

alter table notifications enable row level security;

drop policy if exists "tenant_isolation" on notifications;
create policy "tenant_isolation" on notifications
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
`;

try {
  await sql.unsafe(ddl);
  console.log('notifications table + RLS applied.');

  // Seed a couple of demo notifications for the first tenant so the page shows something
  const [tenant] = await sql`select id from tenants order by created_at asc limit 1`;
  if (tenant) {
    const [c] = await sql`select count(*)::int as n from notifications where tenant_id = ${tenant.id}`;
    if (c.n === 0) {
      await sql`insert into notifications (tenant_id, severity, title, body, href) values
        (${tenant.id}, 'info',     'Welcome to InterioOS', 'Notifications about payments, tasks and site visits will appear here.', '/dashboard'),
        (${tenant.id}, 'warning',  'A quote is awaiting client approval', 'The Kishore residence quote has been in the "sent" state for 3 days.', '/quotes'),
        (${tenant.id}, 'success',  'Payment received', 'Meera Ramaswamy paid ₹50,000 for milestone 2.', '/payments')`;
      console.log('seeded 3 demo notifications for tenant', tenant.id);
    }
  }
} catch (err) {
  console.error('Failed:', err.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
