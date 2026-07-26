import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// 1. Table + RLS
const ddl = `
do $$ begin
  create type document_kind as enum ('folder','file');
exception when duplicate_object then null; end $$;

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  parent_id uuid references documents(id) on delete cascade,
  kind document_kind not null,
  name text not null,
  mime_type text,
  size_bytes integer,
  storage_path text,
  project_id uuid references projects(id) on delete set null,
  uploaded_by uuid references users(id),
  starred boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists documents_tenant_parent_idx on documents (tenant_id, parent_id);
create index if not exists documents_tenant_starred_idx on documents (tenant_id, starred);

alter table documents enable row level security;

drop policy if exists "tenant_isolation" on documents;
create policy "tenant_isolation" on documents
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
`;

try {
  await sql.unsafe(ddl);
  console.log('documents table + RLS applied.');

  // 2. Storage bucket
  const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
  if (listErr) throw listErr;
  const exists = buckets?.some((b) => b.name === 'documents');
  if (exists) {
    console.log('bucket "documents" already exists.');
  } else {
    const { error: bErr } = await supabase.storage.createBucket('documents', {
      public: false,
      fileSizeLimit: '50MB',
    });
    if (bErr) throw bErr;
    console.log('bucket "documents" created (private).');
  }
} catch (err) {
  console.error('Failed:', err.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
