import postgres from 'postgres';
import { config } from 'dotenv';

config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

const ddl = `
do $$ begin
  create type employment_type as enum ('full_time','part_time','contract','intern','consultant');
exception when duplicate_object then null; end $$;

alter table users add column if not exists photo_url text;
alter table users add column if not exists job_title text;
alter table users add column if not exists department text;
alter table users add column if not exists location text;
alter table users add column if not exists employment_type employment_type;
alter table users add column if not exists hire_date date;
alter table users add column if not exists dob date;
alter table users add column if not exists manager_id uuid references users(id) on delete set null;
alter table users add column if not exists emergency_contact_json jsonb;
alter table users add column if not exists status text not null default 'active';

create index if not exists users_tenant_dept_idx on users (tenant_id, department);
create index if not exists users_tenant_manager_idx on users (tenant_id, manager_id);
`;

try {
  await sql.unsafe(ddl);
  console.log('users table extended with HR fields.');
} catch (err) {
  console.error('Failed:', err.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
