-- Anggota awal yang boleh masuk board (login Google).
-- 1. Ganti tiga Gmail di bawah dengan Gmail asli (huruf kecil semua).
-- 2. Jalankan di Supabase → SQL Editor → Run (setelah schema.sql).
-- Setelah ini, admin (SPV) bisa menambah/menonaktifkan anggota dari halaman Anggota di aplikasi.
-- Aman dijalankan ulang: anggota yang sudah ada diperbarui nama, peran, dan warnanya.

insert into public.team_members (email, name, role, color) values
  ('gmail.denny@gmail.com', 'Denny', 'designer', '#00843b'),
  ('gmail.arum@gmail.com',  'Arum',  'designer', '#6b4e3d'),
  ('gmail.spv@gmail.com',   'SPV',   'admin',    '#3f3f46')
on conflict (email) do update
  set name = excluded.name, role = excluded.role, color = excluded.color, active = true;
