-- ════════════════════════════════════════════════════════════════
-- Infarm Design Task Manager — skema database Supabase (v8)
-- Jalankan di Supabase: Dashboard → SQL Editor → New query → tempel seluruh file → Run.
-- Aman dijalankan ulang (idempotent). Setelah ini, isi supabase/anggota-awal.sql.
--
-- Akses:
--   - Requester (tanpa login, peran anon): hanya boleh MENGIRIM request + upload lampiran.
--   - Anggota tim (login Google, email ada di team_members dan aktif): baca dan ubah task.
--   - Admin (SPV): + kelola anggota, pulihkan task terhapus.
-- Riwayat (task_history) dan sesi waktu kerja (work_sessions) hanya ditulis trigger.
-- ════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

-- ─── Anggota tim (yang boleh masuk board) ───────────────────────
create table if not exists public.team_members (
  email text primary key check (email = lower(trim(email)) and email like '%@%'),
  name text not null check (length(trim(name)) > 0),
  role text not null default 'designer' check (role in ('designer', 'admin')),
  active boolean not null default true,
  color text not null default '#00843b',
  created_at timestamptz not null default now()
);

-- Email akun yang sedang login (kosong untuk requester tanpa login).
create or replace function public.current_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.team_members where email = public.current_email() and active);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.team_members where email = public.current_email() and active and role = 'admin');
$$;

-- Dipakai aplikasi setelah login Google: apakah email ini anggota aktif?
create or replace function public.my_membership()
returns public.team_members
language sql
stable
security definer
set search_path = public
as $$
  select * from public.team_members where email = public.current_email() and active;
$$;

-- Nama pelaku untuk riwayat: nama anggota, email lain yang login, atau "sistem" (tugas terjadwal).
create or replace function public.actor_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select name from public.team_members where email = public.current_email()),
    nullif(public.current_email(), ''),
    case when coalesce(auth.jwt() ->> 'role', '') = 'anon' then 'requester' end,
    'sistem'
  );
$$;

-- ─── Task: 1 baris = 1 request desain ───────────────────────────
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  category text not null default 'Lainnya',
  division text not null default 'Lainnya',
  requester_name text not null default '',
  description text not null default '',
  due_date date,
  status text not null default 'request' check (status in ('request', 'on_progress', 'delay', 'finish')),
  pic text,                                               -- penanggung jawab (nama anggota)
  delay_reason text,                                      -- alasan ditunda, hanya saat status delay
  attachments jsonb not null default '[]'::jsonb,         -- [{id, name, size, type: image|pdf, path, url, thumbPath, thumbUrl}]
  reference_links jsonb not null default '[]'::jsonb,     -- [{id, url}]
  result_links jsonb not null default '[]'::jsonb,        -- [{id, url}]
  created_at timestamptz not null default now(),
  started_at timestamptz,                                 -- pertama kali diambil
  finished_at timestamptz,                                -- terakhir masuk Finish
  attachments_deleted_at timestamptz,                     -- lampiran dihapus otomatis
  deleted_at timestamptz,                                 -- arsip (hapus = sembunyikan)
  deleted_by text,
  updated_at timestamptz not null default now(),
  constraint tasks_pic_wajib check (status = 'request' or pic is not null),
  constraint tasks_link_hasil_wajib check (status <> 'finish' or jsonb_array_length(result_links) > 0),
  constraint tasks_lampiran_maks check (jsonb_array_length(attachments) <= 5)
);

create index if not exists tasks_created_at_idx on public.tasks (created_at desc);
create index if not exists tasks_status_idx on public.tasks (status) where deleted_at is null;

-- ─── Checklist: 1 baris = 1 item, bisa dibagi ke beberapa desainer ──
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

-- ─── Sesi waktu kerja: dibuka saat masuk On Progress, ditutup saat keluar ──
create table if not exists public.work_sessions (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.tasks (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  started_by text
);
create index if not exists work_sessions_task_idx on public.work_sessions (task_id);
create unique index if not exists work_sessions_satu_berjalan on public.work_sessions (task_id) where ended_at is null;

-- ─── Riwayat / audit: hanya ditulis trigger, tidak bisa diubah ──
create table if not exists public.task_history (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.tasks (id) on delete cascade,
  created_at timestamptz not null default now(),
  actor_email text,
  actor_name text not null,
  action text not null,
  changes jsonb not null default '[]'::jsonb             -- [{field, before, after}]
);
create index if not exists task_history_task_idx on public.task_history (task_id, created_at desc);
create index if not exists task_history_created_idx on public.task_history (created_at desc);

-- ─── Penanda "sudah dilihat" per akun (badge Baru) ──────────────
create table if not exists public.task_reads (
  task_id uuid not null references public.tasks (id) on delete cascade,
  member_email text not null,
  read_at timestamptz not null default now(),
  primary key (task_id, member_email)
);

-- ─── Jam kerja: Senin–Jumat 08.00–17.00 WIB ─────────────────────
-- Padanannya di JS: workMinutesBetween() di src/lib/worktime.js. Keduanya harus sama.
create or replace function public.work_minutes(p_start timestamptz, p_end timestamptz)
returns integer
language sql
immutable
as $$
  with b as (
    select (p_start at time zone 'Asia/Jakarta') as s, (p_end at time zone 'Asia/Jakarta') as e
  )
  select coalesce(floor(sum(
    greatest(0, extract(epoch from least(b.e, d + time '17:00') - greatest(b.s, d + time '08:00')))
  ) / 60)::int, 0)
  from b, generate_series(b.s::date, b.e::date, interval '1 day') as d
  where p_end > p_start and extract(isodow from d) < 6;
$$;

-- ─── Perbandingan isi task untuk riwayat ────────────────────────
-- Lampiran dan link dicatat sebagai daftar nama/URL. Padanan JS: taskChanges() di src/data/taskModel.js.
create or replace function public.task_changes(o public.tasks, n public.tasks)
returns jsonb
language sql
stable
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
    (9, 'delay_reason', to_jsonb(o.delay_reason), to_jsonb(n.delay_reason)),
    (10, 'attachments',
      (select coalesce(jsonb_agg(e->'name'), '[]'::jsonb) from jsonb_array_elements(o.attachments) e),
      (select coalesce(jsonb_agg(e->'name'), '[]'::jsonb) from jsonb_array_elements(n.attachments) e)),
    (11, 'reference_links',
      (select coalesce(jsonb_agg(e->'url'), '[]'::jsonb) from jsonb_array_elements(o.reference_links) e),
      (select coalesce(jsonb_agg(e->'url'), '[]'::jsonb) from jsonb_array_elements(n.reference_links) e)),
    (12, 'result_links',
      (select coalesce(jsonb_agg(e->'url'), '[]'::jsonb) from jsonb_array_elements(o.result_links) e),
      (select coalesce(jsonb_agg(e->'url'), '[]'::jsonb) from jsonb_array_elements(n.result_links) e))
  ) as v(ord, field, before, after)
  where v.before is distinct from v.after;
$$;

-- Nama aksi dari perpindahan kolom. Padanan JS: historyAction() di src/data/taskModel.js.
create or replace function public.task_action(old_status text, new_status text)
returns text
language sql
immutable
as $$
  select case
    when old_status = new_status then 'diubah'
    when old_status = 'request' and new_status = 'on_progress' then 'diambil'
    when old_status = 'finish' then 'revisi'
    when new_status = 'delay' then 'ditunda'
    when old_status = 'delay' and new_status = 'on_progress' then 'dilanjutkan'
    when new_status = 'finish' then 'selesai'
    when new_status = 'request' then 'dilepas'
    else 'dipindah'
  end;
$$;

-- ─── Trigger task ───────────────────────────────────────────────

-- Sebelum ubah: aturan arsip + pembukuan otomatis saat pindah kolom.
create or replace function public.tasks_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.deleted_at is not null and not public.is_admin() then
    raise exception 'task_terhapus' using errcode = '42501';
  end if;
  if old.deleted_at is not null and new.deleted_at is null then
    new.deleted_by := null;
  elsif old.deleted_at is null and new.deleted_at is not null then
    new.deleted_by := public.current_email();
  end if;

  if new.status is distinct from old.status then
    if new.status = 'request' then
      new.pic := null;                                    -- dikembalikan ke Request = PIC dilepas
    end if;
    if new.status = 'on_progress' and new.started_at is null then
      new.started_at := now();
    end if;
    if new.status = 'finish' then
      new.finished_at := now();
    elsif old.status = 'finish' then
      new.finished_at := null;                            -- revisi
    end if;
  end if;
  if new.status <> 'delay' then
    new.delay_reason := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tasks_before_update on public.tasks;
create trigger tasks_before_update before update on public.tasks
  for each row execute function public.tasks_before_update();

-- Request baru: selalu bersih, apa pun yang dikirim browser.
create or replace function public.tasks_before_insert()
returns trigger
language plpgsql
as $$
begin
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tasks_before_insert on public.tasks;
create trigger tasks_before_insert before insert on public.tasks
  for each row execute function public.tasks_before_insert();

-- Setelah tambah/ubah: sesi waktu kerja + riwayat.
create or replace function public.tasks_after_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changes jsonb;
  v_action text;
begin
  -- Sesi waktu kerja hanya berjalan selama On Progress.
  if new.status = 'on_progress' and (tg_op = 'INSERT' or old.status <> 'on_progress') then
    insert into public.work_sessions (task_id, started_by) values (new.id, nullif(public.current_email(), ''))
    on conflict do nothing;
  elsif tg_op = 'UPDATE' and old.status = 'on_progress' and new.status <> 'on_progress' then
    update public.work_sessions set ended_at = now() where task_id = new.id and ended_at is null;
  end if;

  if tg_op = 'INSERT' then
    insert into public.task_history (task_id, actor_email, actor_name, action)
    values (new.id, nullif(public.current_email(), ''),
            coalesce(nullif(trim(new.requester_name), '') || ' (requester)', public.actor_name()), 'dibuat');
    return new;
  end if;

  v_changes := public.task_changes(old, new);
  v_action := case
    when old.deleted_at is null and new.deleted_at is not null then 'dihapus'
    when old.deleted_at is not null and new.deleted_at is null then 'dipulihkan'
    when old.attachments_deleted_at is null and new.attachments_deleted_at is not null then 'lampiran_dihapus'
    else public.task_action(old.status, new.status)
  end;
  if v_changes <> '[]'::jsonb or v_action in ('dihapus', 'dipulihkan', 'lampiran_dihapus') then
    insert into public.task_history (task_id, actor_email, actor_name, action, changes)
    values (new.id, nullif(public.current_email(), ''), public.actor_name(), v_action, v_changes);
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_after_write on public.tasks;
create trigger tasks_after_write after insert or update on public.tasks
  for each row execute function public.tasks_after_write();

-- Checklist ikut tercatat di riwayat task.
create or replace function public.checklist_after_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task uuid := coalesce(new.task_id, old.task_id);
  v_before text;
  v_after text;
begin
  -- Task dihapus permanen (mis. dari dashboard): checklist ikut terhapus, tidak perlu dicatat.
  if not exists (select 1 from public.tasks where id = v_task) then
    return null;
  end if;
  if tg_op <> 'INSERT' then
    v_before := old.text || ' · ' || coalesce(old.assignee, '-') || case when old.done then ' · selesai' else '' end;
  end if;
  if tg_op <> 'DELETE' then
    v_after := new.text || ' · ' || coalesce(new.assignee, '-') || case when new.done then ' · selesai' else '' end;
  end if;
  if v_before is distinct from v_after then
    insert into public.task_history (task_id, actor_email, actor_name, action, changes)
    values (v_task, nullif(public.current_email(), ''), public.actor_name(), 'checklist',
            jsonb_build_array(jsonb_build_object('field', 'checklist', 'before', v_before, 'after', v_after)));
  end if;
  return null;
end;
$$;

drop trigger if exists checklist_after_write on public.task_checklist;
create trigger checklist_after_write after insert or update or delete on public.task_checklist
  for each row execute function public.checklist_after_write();

create or replace function public.checklist_before_write()
returns trigger
language plpgsql
as $$
begin
  if new.done and not coalesce(old.done, false) then
    new.done_at := now();
  elsif not new.done then
    new.done_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists checklist_before_write on public.task_checklist;
create trigger checklist_before_write before insert or update on public.task_checklist
  for each row execute function public.checklist_before_write();

-- ─── Hak akses (RLS) ────────────────────────────────────────────
alter table public.team_members enable row level security;
alter table public.tasks enable row level security;
alter table public.task_checklist enable row level security;
alter table public.work_sessions enable row level security;
alter table public.task_history enable row level security;
alter table public.task_reads enable row level security;

revoke all on public.team_members, public.tasks, public.task_checklist, public.work_sessions,
  public.task_history, public.task_reads from anon, authenticated;

grant insert on public.tasks to anon, authenticated;
grant select, update on public.tasks to authenticated;
grant select, insert, update, delete on public.task_checklist to authenticated;
grant select on public.work_sessions, public.task_history to authenticated;
grant select, insert on public.task_reads to authenticated;
grant select, insert, update, delete on public.team_members to authenticated;

-- Requester: hanya request baru yang bersih (tanpa PIC, hasil, status lain).
drop policy if exists "Kirim request baru" on public.tasks;
create policy "Kirim request baru" on public.tasks
  for insert to anon, authenticated
  with check (
    status = 'request' and pic is null and delay_reason is null
    and started_at is null and finished_at is null
    and attachments_deleted_at is null and deleted_at is null and deleted_by is null
    and result_links = '[]'::jsonb
  );

drop policy if exists "Anggota melihat task" on public.tasks;
create policy "Anggota melihat task" on public.tasks
  for select to authenticated using (public.is_member());

drop policy if exists "Anggota mengubah task" on public.tasks;
create policy "Anggota mengubah task" on public.tasks
  for update to authenticated using (public.is_member()) with check (public.is_member());

drop policy if exists "Anggota mengelola checklist" on public.task_checklist;
create policy "Anggota mengelola checklist" on public.task_checklist
  for all to authenticated using (public.is_member()) with check (public.is_member());

drop policy if exists "Anggota melihat sesi kerja" on public.work_sessions;
create policy "Anggota melihat sesi kerja" on public.work_sessions
  for select to authenticated using (public.is_member());

drop policy if exists "Anggota melihat riwayat" on public.task_history;
create policy "Anggota melihat riwayat" on public.task_history
  for select to authenticated using (public.is_member());

drop policy if exists "Penanda baca milik sendiri" on public.task_reads;
create policy "Penanda baca milik sendiri" on public.task_reads
  for all to authenticated
  using (public.is_member() and member_email = public.current_email())
  with check (public.is_member() and member_email = public.current_email());

drop policy if exists "Anggota melihat daftar anggota" on public.team_members;
create policy "Anggota melihat daftar anggota" on public.team_members
  for select to authenticated using (public.is_member());

drop policy if exists "Admin mengelola anggota" on public.team_members;
create policy "Admin mengelola anggota" on public.team_members
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on function public.is_member(), public.is_admin(), public.my_membership(), public.actor_name() from public;
grant execute on function public.is_member(), public.is_admin(), public.my_membership(), public.current_email() to anon, authenticated;
grant execute on function public.work_minutes(timestamptz, timestamptz) to authenticated;

-- ─── Penyimpanan lampiran (foto + PDF) ──────────────────────────
-- Bucket publik "references": <id task>/<id file>.<ext>. Nama file acak (UUID), tidak bisa ditebak.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('references', 'references', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Upload lampiran request" on storage.objects;
create policy "Upload lampiran request" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'references');

drop policy if exists "Anggota melihat lampiran" on storage.objects;
create policy "Anggota melihat lampiran" on storage.objects
  for select to authenticated
  using (bucket_id = 'references' and public.is_member());

drop policy if exists "Anggota menghapus lampiran" on storage.objects;
create policy "Anggota menghapus lampiran" on storage.objects
  for delete to authenticated
  using (bucket_id = 'references' and public.is_member());

-- ─── Realtime: board ikut berubah otomatis ──────────────────────
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
