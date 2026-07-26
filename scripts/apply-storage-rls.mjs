import postgres from 'postgres';
import { config } from 'dotenv';

config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

// Path convention: {tenantId}/{documentId}/{filename}
// A caller may read/write only paths whose first segment matches their tenant.
const ddl = `
drop policy if exists "docs tenant read"   on storage.objects;
drop policy if exists "docs tenant write"  on storage.objects;
drop policy if exists "docs tenant update" on storage.objects;
drop policy if exists "docs tenant delete" on storage.objects;

create policy "docs tenant read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

create policy "docs tenant write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

create policy "docs tenant update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

create policy "docs tenant delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );
`;

try {
  await sql.unsafe(ddl);
  console.log('storage.objects tenant policies applied for bucket "documents".');
} catch (err) {
  console.error('Failed:', err.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
