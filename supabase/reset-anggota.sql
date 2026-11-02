-- Ganti SEMUA anggota (mis. akun uji coba) dengan anggota asli.
-- 1. Ganti tiga Gmail di bawah dengan Gmail asli tim desain dan SPV (huruf kecil semua).
-- 2. Jalankan di Supabase → SQL Editor → Run.
-- Anggota lama langsung tidak bisa masuk lagi. Task, checklist, dan riwayat tidak terhapus
-- (riwayat lama tetap mencatat nama pelaku saat itu).

begin;

delete from public.team_members;

insert into public.team_members (email, name, role, color) values
  ('gmail.denny@gmail.com', 'Denny', 'designer', '#00843b'),
  ('gmail.arum@gmail.com',  'Arum',  'designer', '#6b4e3d'),
  ('gmail.spv@gmail.com',   'SPV',   'admin',    '#3f3f46');

commit;

-- Cek hasilnya:
select email, name, role, active from public.team_members order by role, name;

-- ─── Opsional: kosongkan semua task uji coba ─────────────────────
-- Hapus tanda "--" di baris berikut bila ingin board mulai dari kosong.
-- Checklist, riwayat, sesi waktu, dan penanda "sudah dilihat" ikut terhapus.
-- File lampiran di Storage TIDAK ikut terhapus: hapus manual di Storage → references.
-- delete from public.tasks;
