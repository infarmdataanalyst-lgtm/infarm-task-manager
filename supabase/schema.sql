-- ════════════════════════════════════════════════════════════════
-- Infarm Design Task Manager — skema database Supabase
-- Jalankan SEKALI di Supabase: Dashboard → SQL Editor → New query → tempel → Run.
-- Aman dijalankan ulang (idempotent).
-- Setelah ini, atur PIN tim dengan supabase/set-pin.sql.
-- ════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

-- ─── Tabel task ─────────────────────────────────────────────────
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  category text not null default 'Lainnya',
  division text not null default 'Lainnya',
  requester_name text not null default '',
  description text not null default '',
  due_date date,
  status text not null default 'request' check (status in ('request', 'todo', 'on_progress', 'finish')),
  pic text,
  reference_images jsonb not null default '[]'::jsonb,   -- [{id, name, size, path, url}]
  reference_links jsonb not null default '[]'::jsonb,    -- [{id, url}]
  result_links jsonb not null default '[]'::jsonb,       -- [{id, url}]
  checklist jsonb not null default '[]'::jsonb,          -- [{id, text, done, assignee}]
  created_at timestamptz not null default now(),
  assigned_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  reference_images_deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  -- Aturan alur kerja, ditegakkan database:
  constraint tasks_pic_wajib check (status = 'request' or pic is not null),
  constraint tasks_link_hasil_wajib check (status <> 'finish' or jsonb_array_length(result_links) > 0)
);

create index if not exists tasks_created_at_idx on public.tasks (created_at desc);
create index if not exists tasks_status_idx on public.tasks (status);

-- ─── Pengaturan rahasia (hash PIN tim) ──────────────────────────
-- RLS aktif tanpa policy: tidak bisa dibaca/diubah dari browser sama sekali.
create table if not exists public.app_settings (
  key text primary key,
  value text not null
);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;

-- ─── Hak akses publik (requester, tanpa login) ──────────────────
alter table public.tasks enable row level security;

grant select, insert on public.tasks to anon, authenticated;
revoke update, delete on public.tasks from anon, authenticated;

drop policy if exists "Semua orang boleh melihat task" on public.tasks;
create policy "Semua orang boleh melihat task" on public.tasks
  for select to anon, authenticated using (true);

-- Requester hanya boleh membuat request baru yang "bersih".
drop policy if exists "Requester boleh membuat request baru" on public.tasks;
create policy "Requester boleh membuat request baru" on public.tasks
  for insert to anon, authenticated
  with check (
    status = 'request'
    and pic is null
    and assigned_at is null and started_at is null and finished_at is null
    and result_links = '[]'::jsonb
    and checklist = '[]'::jsonb
    and jsonb_array_length(reference_images) <= 6
  );

-- ─── Fungsi tim (wajib PIN) ─────────────────────────────────────
-- Semua perubahan dari board lewat fungsi ini. PIN dicek di server.

create or replace function public.team_pin_valid(p_pin text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from public.app_settings
    where key = 'team_pin_sha256'
      and value = encode(extensions.digest(coalesce(p_pin, ''), 'sha256'), 'hex')
  );
$$;

-- Dipakai layar PIN untuk mengecek PIN.
create or replace function public.team_check_pin(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.team_pin_valid(p_pin) then
    perform pg_sleep(1);  -- memperlambat tebak-tebakan PIN
    return false;
  end if;
  return true;
end;
$$;

-- Ubah task. p_patch hanya boleh berisi kolom di bawah ini (kolom lain diabaikan).
create or replace function public.team_update_task(p_pin text, p_id uuid, p_patch jsonb)
returns public.tasks
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  result public.tasks;
begin
  if not public.team_pin_valid(p_pin) then
    perform pg_sleep(1);
    raise exception 'invalid_pin' using errcode = '28000';
  end if;

  update public.tasks t set
    title = case when p_patch ? 'title' then p_patch->>'title' else t.title end,
    category = case when p_patch ? 'category' then p_patch->>'category' else t.category end,
    division = case when p_patch ? 'division' then p_patch->>'division' else t.division end,
    requester_name = case when p_patch ? 'requester_name' then p_patch->>'requester_name' else t.requester_name end,
    description = case when p_patch ? 'description' then p_patch->>'description' else t.description end,
    due_date = case when p_patch ? 'due_date' then nullif(p_patch->>'due_date', '')::date else t.due_date end,
    status = case when p_patch ? 'status' then p_patch->>'status' else t.status end,
    pic = case when p_patch ? 'pic' then p_patch->>'pic' else t.pic end,
    reference_images = case when p_patch ? 'reference_images' then p_patch->'reference_images' else t.reference_images end,
    reference_links = case when p_patch ? 'reference_links' then p_patch->'reference_links' else t.reference_links end,
    result_links = case when p_patch ? 'result_links' then p_patch->'result_links' else t.result_links end,
    checklist = case when p_patch ? 'checklist' then p_patch->'checklist' else t.checklist end,
    assigned_at = case when p_patch ? 'assigned_at' then (p_patch->>'assigned_at')::timestamptz else t.assigned_at end,
    started_at = case when p_patch ? 'started_at' then (p_patch->>'started_at')::timestamptz else t.started_at end,
    finished_at = case when p_patch ? 'finished_at' then (p_patch->>'finished_at')::timestamptz else t.finished_at end,
    reference_images_deleted_at = case when p_patch ? 'reference_images_deleted_at'
      then (p_patch->>'reference_images_deleted_at')::timestamptz else t.reference_images_deleted_at end,
    updated_at = now()
  where t.id = p_id
  returning * into result;

  if result.id is null then
    raise exception 'task_not_found' using errcode = 'P0002';
  end if;
  return result;
end;
$$;

create or replace function public.team_delete_task(p_pin text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.team_pin_valid(p_pin) then
    perform pg_sleep(1);
    raise exception 'invalid_pin' using errcode = '28000';
  end if;
  delete from public.tasks where id = p_id;
end;
$$;

revoke all on function public.team_pin_valid(text) from public, anon, authenticated;
grant execute on function public.team_check_pin(text) to anon, authenticated;
grant execute on function public.team_update_task(text, uuid, jsonb) to anon, authenticated;
grant execute on function public.team_delete_task(text, uuid) to anon, authenticated;

-- ─── Penyimpanan gambar referensi ───────────────────────────────
-- Bucket publik "references". File disimpan di "<id task>/<nama file>".
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('references', 'references', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Requester boleh meng-upload gambar referensi.
drop policy if exists "Upload gambar referensi" on storage.objects;
create policy "Upload gambar referensi" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'references');

-- Bucket ini publik; izin SELECT tetap perlu karena penghapusan file mensyaratkannya.
drop policy if exists "Lihat gambar referensi" on storage.objects;
create policy "Lihat gambar referensi" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'references');

-- Gambar hanya boleh dihapus kalau task-nya sudah Finish atau sudah dihapus.
drop policy if exists "Hapus gambar referensi task selesai" on storage.objects;
create policy "Hapus gambar referensi task selesai" on storage.objects
  for delete to anon, authenticated
  using (
    bucket_id = 'references'
    and not exists (
      select 1 from public.tasks t
      where t.id::text = (storage.foldername(name))[1]
        and t.status <> 'finish'
    )
  );

-- ─── Realtime: board & halaman status ikut berubah otomatis ─────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tasks'
  ) then
    alter publication supabase_realtime add table public.tasks;
  end if;
end;
$$;
