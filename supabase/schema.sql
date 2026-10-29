-- ════════════════════════════════════════════════════════════════
-- Infarm Design Task Manager — skema database Supabase (v7)
-- Jalankan di Supabase: Dashboard → SQL Editor → New query → tempel seluruh file → Run.
-- Berlaku untuk proyek baru MAUPUN database yang sudah memakai skema v6 (checklist di kolom
-- tasks.checklist): checklist lama otomatis dipindah ke tabel task_checklist tanpa hilang.
-- Aman dijalankan ulang (idempotent).
-- Setelah ini, atur PIN tim dengan supabase/set-pin.sql.
-- ════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

-- ─── Tabel task: 1 baris = 1 request desain ─────────────────────
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  category text not null default 'Lainnya',
  division text not null default 'Lainnya',
  requester_name text not null default '',
  description text not null default '',
  due_date date,
  status text not null default 'request' check (status in ('request', 'todo', 'on_progress', 'finish')),
  pic text,                                               -- penanggung jawab; pengerja lain lewat task_checklist.assignee
  reference_images jsonb not null default '[]'::jsonb,   -- [{id, name, size, path, url}]
  reference_links jsonb not null default '[]'::jsonb,    -- [{id, url}]
  result_links jsonb not null default '[]'::jsonb,       -- [{id, url}]
  created_at timestamptz not null default now(),
  assigned_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  reference_images_deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  requester_updated_at timestamptz,                       -- terakhir diedit requester
  pic_seen_at timestamptz,                                -- terakhir tim membuka detail (badge "Diperbarui requester")
  -- Aturan alur kerja, ditegakkan database:
  constraint tasks_pic_wajib check (status = 'request' or pic is not null),
  constraint tasks_link_hasil_wajib check (status <> 'finish' or jsonb_array_length(result_links) > 0)
);

-- Upgrade dari v6 (tidak berpengaruh pada database baru).
alter table public.tasks add column if not exists requester_updated_at timestamptz;
alter table public.tasks add column if not exists pic_seen_at timestamptz;

create index if not exists tasks_created_at_idx on public.tasks (created_at desc);
create index if not exists tasks_status_idx on public.tasks (status);

-- ─── Checklist: 1 baris = 1 item, bisa dibagi ke beberapa desainer ──
-- Tabel sendiri supaya dua orang yang mencentang bersamaan tidak saling menimpa.
create table if not exists public.task_checklist (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  text text not null check (length(trim(text)) > 0),
  assignee text,
  done boolean not null default false,
  done_at timestamptz,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists task_checklist_task_idx on public.task_checklist (task_id, position);

-- Upgrade dari v6: pindahkan checklist lama (jsonb di tasks.checklist) ke task_checklist, sekali saja.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks' and column_name = 'checklist'
  ) then
    drop policy if exists "Requester boleh membuat request baru" on public.tasks;  -- policy lama memakai kolom ini
    insert into public.task_checklist (id, task_id, text, assignee, done, done_at, position, created_at)
    select
      case when e.item->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (e.item->>'id')::uuid else gen_random_uuid() end,
      t.id,
      coalesce(nullif(trim(e.item->>'text'), ''), '(tanpa teks)'),
      nullif(e.item->>'assignee', ''),
      coalesce((e.item->>'done')::boolean, false),
      case when coalesce((e.item->>'done')::boolean, false) then t.updated_at end,
      (e.ord - 1)::int,
      t.created_at
    from public.tasks t
    cross join lateral jsonb_array_elements(t.checklist) with ordinality as e(item, ord)
    on conflict (id) do nothing;
    alter table public.tasks drop column checklist;
  end if;
end;
$$;

-- ─── Riwayat: siapa mengubah apa dan kapan ──────────────────────
-- Hanya ditulis oleh fungsi server di bawah. changes = [{field, before, after}].
create table if not exists public.task_history (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.tasks (id) on delete cascade,
  created_at timestamptz not null default now(),
  actor text not null check (actor in ('requester', 'tim')),
  action text not null,
  changes jsonb not null default '[]'::jsonb
);

create index if not exists task_history_task_idx on public.task_history (task_id, created_at desc);

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
alter table public.task_checklist enable row level security;
alter table public.task_history enable row level security;

grant select, insert on public.tasks to anon, authenticated;
revoke update, delete on public.tasks from anon, authenticated;
grant select on public.task_checklist, public.task_history to anon, authenticated;
revoke insert, update, delete on public.task_checklist, public.task_history from anon, authenticated;

drop policy if exists "Semua orang boleh melihat task" on public.tasks;
create policy "Semua orang boleh melihat task" on public.tasks
  for select to anon, authenticated using (true);

drop policy if exists "Semua orang boleh melihat checklist" on public.task_checklist;
create policy "Semua orang boleh melihat checklist" on public.task_checklist
  for select to anon, authenticated using (true);

drop policy if exists "Semua orang boleh melihat riwayat" on public.task_history;
create policy "Semua orang boleh melihat riwayat" on public.task_history
  for select to anon, authenticated using (true);

-- Requester hanya boleh membuat request baru yang "bersih".
drop policy if exists "Requester boleh membuat request baru" on public.tasks;
create policy "Requester boleh membuat request baru" on public.tasks
  for insert to anon, authenticated
  with check (
    status = 'request'
    and pic is null
    and assigned_at is null and started_at is null and finished_at is null
    and requester_updated_at is null and pic_seen_at is null
    and result_links = '[]'::jsonb
    and jsonb_array_length(reference_images) <= 6
  );

-- ─── Perbandingan isi task untuk riwayat ────────────────────────
-- Gambar dan link dicatat sebagai daftar nama/URL supaya mudah dibaca.
create or replace function public.task_changes(o public.tasks, n public.tasks)
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('field', v.field, 'before', v.before, 'after', v.after) order by v.ord), '[]'::jsonb)
  from (values
    (1, 'title', to_jsonb(o.title), to_jsonb(n.title)),
    (2, 'category', to_jsonb(o.category), to_jsonb(n.category)),
    (3, 'division', to_jsonb(o.division), to_jsonb(n.division)),
    (4, 'requester_name', to_jsonb(o.requester_name), to_jsonb(n.requester_name)),
    (5, 'description', to_jsonb(o.description), to_jsonb(n.description)),
    (6, 'due_date', to_jsonb(o.due_date), to_jsonb(n.due_date)),
    (7, 'status', to_jsonb(o.status), to_jsonb(n.status)),
    (8, 'pic', to_jsonb(o.pic), to_jsonb(n.pic)),
    (9, 'reference_images',
      (select coalesce(jsonb_agg(e->'name'), '[]'::jsonb) from jsonb_array_elements(o.reference_images) e),
      (select coalesce(jsonb_agg(e->'name'), '[]'::jsonb) from jsonb_array_elements(n.reference_images) e)),
    (10, 'reference_links',
      (select coalesce(jsonb_agg(e->'url'), '[]'::jsonb) from jsonb_array_elements(o.reference_links) e),
      (select coalesce(jsonb_agg(e->'url'), '[]'::jsonb) from jsonb_array_elements(n.reference_links) e)),
    (11, 'result_links',
      (select coalesce(jsonb_agg(e->'url'), '[]'::jsonb) from jsonb_array_elements(o.result_links) e),
      (select coalesce(jsonb_agg(e->'url'), '[]'::jsonb) from jsonb_array_elements(n.result_links) e))
  ) as v(ord, field, before, after)
  where v.before is distinct from v.after;
$$;

-- Nama aksi riwayat dari perubahan status (sama dengan historyAction di src/data/taskModel.js).
create or replace function public.task_action(old_status text, new_status text)
returns text
language sql
immutable
as $$
  select case
    when old_status = new_status then 'diubah'
    when old_status = 'request' and new_status = 'todo' then 'diambil'
    when old_status = 'finish' and new_status = 'on_progress' then 'revisi'
    when new_status = 'on_progress' then 'dimulai'
    when new_status = 'finish' then 'selesai'
    when new_status = 'request' then 'dilepas'
    else 'dikembalikan'
  end;
$$;

-- Riwayat "dibuat" untuk setiap request baru.
create or replace function public.log_task_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.task_history (task_id, actor, action) values (new.id, 'requester', 'dibuat');
  return new;
end;
$$;

drop trigger if exists tasks_log_created on public.tasks;
create trigger tasks_log_created after insert on public.tasks
  for each row execute function public.log_task_created();

-- ─── Requester mengedit request (tanpa login) ───────────────────
-- Hanya selama status Request atau Todo. Field yang boleh diubah: detail request dan referensi.
create or replace function public.requester_update_task(p_id uuid, p_patch jsonb)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.tasks;
  n public.tasks;
  v_changes jsonb;
begin
  select * into o from public.tasks where id = p_id for update;
  if o.id is null then
    raise exception 'task_not_found' using errcode = 'P0002';
  end if;
  if o.status not in ('request', 'todo') then
    raise exception 'edit_locked' using errcode = '42501';
  end if;
  if p_patch ? 'reference_images'
     and (jsonb_typeof(p_patch->'reference_images') <> 'array' or jsonb_array_length(p_patch->'reference_images') > 6) then
    raise exception 'too_many_images' using errcode = '22023';
  end if;

  update public.tasks t set
    title = case when p_patch ? 'title' then p_patch->>'title' else t.title end,
    category = case when p_patch ? 'category' then p_patch->>'category' else t.category end,
    division = case when p_patch ? 'division' then p_patch->>'division' else t.division end,
    requester_name = case when p_patch ? 'requester_name' then p_patch->>'requester_name' else t.requester_name end,
    description = case when p_patch ? 'description' then p_patch->>'description' else t.description end,
    due_date = case when p_patch ? 'due_date' then nullif(p_patch->>'due_date', '')::date else t.due_date end,
    reference_images = case when p_patch ? 'reference_images' then p_patch->'reference_images' else t.reference_images end,
    reference_links = case when p_patch ? 'reference_links' then p_patch->'reference_links' else t.reference_links end,
    requester_updated_at = now(),
    updated_at = now()
  where t.id = p_id
  returning * into n;

  v_changes := public.task_changes(o, n);
  if v_changes = '[]'::jsonb then
    raise exception 'no_changes' using errcode = '22023';  -- membatalkan update di atas
  end if;
  insert into public.task_history (task_id, actor, action, changes) values (p_id, 'requester', 'diedit', v_changes);
  return n;
end;
$$;

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

create or replace function public.team_require_pin(p_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.team_pin_valid(p_pin) then
    perform pg_sleep(1);  -- memperlambat tebak-tebakan PIN
    raise exception 'invalid_pin' using errcode = '28000';
  end if;
end;
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
    perform pg_sleep(1);
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
  o public.tasks;
  n public.tasks;
  v_changes jsonb;
begin
  perform public.team_require_pin(p_pin);

  select * into o from public.tasks where id = p_id for update;
  if o.id is null then
    raise exception 'task_not_found' using errcode = 'P0002';
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
    assigned_at = case when p_patch ? 'assigned_at' then (p_patch->>'assigned_at')::timestamptz else t.assigned_at end,
    started_at = case when p_patch ? 'started_at' then (p_patch->>'started_at')::timestamptz else t.started_at end,
    finished_at = case when p_patch ? 'finished_at' then (p_patch->>'finished_at')::timestamptz else t.finished_at end,
    reference_images_deleted_at = case when p_patch ? 'reference_images_deleted_at'
      then (p_patch->>'reference_images_deleted_at')::timestamptz else t.reference_images_deleted_at end,
    updated_at = now()
  where t.id = p_id
  returning * into n;

  v_changes := public.task_changes(o, n);
  if v_changes <> '[]'::jsonb then
    insert into public.task_history (task_id, actor, action, changes)
    values (p_id, 'tim', public.task_action(o.status, n.status), v_changes);
  end if;
  return n;
end;
$$;

-- Tim membuka detail task: badge "Diperbarui requester" hilang.
create or replace function public.team_mark_seen(p_pin text, p_id uuid)
returns public.tasks
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  n public.tasks;
begin
  perform public.team_require_pin(p_pin);
  update public.tasks set pic_seen_at = now() where id = p_id returning * into n;
  if n.id is null then
    raise exception 'task_not_found' using errcode = 'P0002';
  end if;
  return n;
end;
$$;

create or replace function public.team_delete_task(p_pin text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.team_require_pin(p_pin);
  delete from public.tasks where id = p_id;
end;
$$;

-- Checklist: setiap aksi hanya mengubah satu item.
create or replace function public.team_add_checklist_item(p_pin text, p_task_id uuid, p_text text, p_assignee text)
returns public.task_checklist
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r public.task_checklist;
begin
  perform public.team_require_pin(p_pin);
  if not exists (select 1 from public.tasks where id = p_task_id) then
    raise exception 'task_not_found' using errcode = 'P0002';
  end if;
  insert into public.task_checklist (task_id, text, assignee, position)
  values (
    p_task_id, trim(p_text), nullif(p_assignee, ''),
    coalesce((select max(position) + 1 from public.task_checklist where task_id = p_task_id), 0)
  )
  returning * into r;
  return r;
end;
$$;

create or replace function public.team_update_checklist_item(p_pin text, p_id uuid, p_patch jsonb)
returns public.task_checklist
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r public.task_checklist;
begin
  perform public.team_require_pin(p_pin);
  update public.task_checklist c set
    text = case when p_patch ? 'text' then trim(p_patch->>'text') else c.text end,
    assignee = case when p_patch ? 'assignee' then nullif(p_patch->>'assignee', '') else c.assignee end,
    done = case when p_patch ? 'done' then (p_patch->>'done')::boolean else c.done end,
    done_at = case
      when not (p_patch ? 'done') then c.done_at
      when (p_patch->>'done')::boolean then coalesce(c.done_at, now())
      else null
    end
  where c.id = p_id
  returning * into r;
  if r.id is null then
    raise exception 'checklist_not_found' using errcode = 'P0002';
  end if;
  return r;
end;
$$;

create or replace function public.team_delete_checklist_item(p_pin text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.team_require_pin(p_pin);
  delete from public.task_checklist where id = p_id;
end;
$$;

revoke all on function public.team_pin_valid(text) from public, anon, authenticated;
revoke all on function public.team_require_pin(text) from public, anon, authenticated;
revoke all on function public.log_task_created() from public, anon, authenticated;
grant execute on function public.team_check_pin(text) to anon, authenticated;
grant execute on function public.team_update_task(text, uuid, jsonb) to anon, authenticated;
grant execute on function public.team_mark_seen(text, uuid) to anon, authenticated;
grant execute on function public.team_delete_task(text, uuid) to anon, authenticated;
grant execute on function public.team_add_checklist_item(text, uuid, text, text) to anon, authenticated;
grant execute on function public.team_update_checklist_item(text, uuid, jsonb) to anon, authenticated;
grant execute on function public.team_delete_checklist_item(text, uuid) to anon, authenticated;
grant execute on function public.requester_update_task(uuid, jsonb) to anon, authenticated;

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

-- Gambar boleh dihapus kalau task-nya sudah Finish, sudah dihapus, atau gambar itu
-- sudah tidak dipakai task-nya (misalnya dibuang requester saat mengedit request).
drop policy if exists "Hapus gambar referensi task selesai" on storage.objects;
drop policy if exists "Hapus gambar referensi yang tidak dipakai" on storage.objects;
create policy "Hapus gambar referensi yang tidak dipakai" on storage.objects
  for delete to anon, authenticated
  using (
    bucket_id = 'references'
    and not exists (
      select 1 from public.tasks t
      where t.id::text = (storage.foldername(name))[1]
        and t.status <> 'finish'
        and t.reference_images @> jsonb_build_array(jsonb_build_object('path', name))
    )
  );

-- ─── Realtime: board & halaman status ikut berubah otomatis ─────
do $$
declare
  tbl text;
begin
  foreach tbl in array array['tasks', 'task_checklist'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    end if;
  end loop;
end;
$$;
