# Panduan menghubungkan Supabase (v8: login Google)

Panduan ini untuk pemilik proyek. Kode aplikasi sudah siap; langkah di bawah hanya pengaturan akun, database, Google, dan Vercel.

Selama variabel Supabase belum diisi di Vercel, aplikasi berjalan dalam **mode uji coba** (data hanya di browser, login memakai akun tiruan, ada banner oranye).

## 1. Proyek Supabase

1. Buka https://supabase.com, buat proyek baru (**Region:** Southeast Asia (Singapore), **Plan:** Free).
2. Catat **Project URL**, contoh `https://abcdefghijkl.supabase.co`.

## 2. Login Google (Google Cloud Console)

Login ke https://console.cloud.google.com dengan akun yang akan mengelola aplikasi.

1. **Buat proyek:** klik pemilih proyek di bar atas → **New Project** → nama `Infarm Design Task` → **Create**, lalu pilih proyek itu.
2. **Google Auth Platform** (dulu "OAuth consent screen") → **Get started**:
   - App name `Design Task Hub Infarm`, support email Anda → **Next**
   - Audience **External** → **Next**
   - Contact email → **Next** → centang persetujuan → **Continue** → **Create**
3. **Data Access** → **Add or remove scopes** → centang `.../auth/userinfo.email`, `.../auth/userinfo.profile`, `openid` → **Update** → **Save**.
4. **Audience** → biarkan status **Testing** → **Test users** → **+ Add users** → masukkan Gmail Denny, Arum, SPV, dan pengelola → **Save**.
   - Hanya Gmail di daftar ini yang bisa login lewat Google. Saat pertama login muncul layar "Google hasn't verified this app": klik **Continue**.
   - Tombol **Publish app** baru aktif bila Branding punya homepage dan privacy policy URL; tidak diperlukan untuk tim kecil.
5. **Clients** → **+ Create client** → **Web application**, nama `Supabase Infarm`.
   - **Authorized redirect URIs:** `https://<kode-proyek>.supabase.co/auth/v1/callback` (sama persis dengan Callback URL di Supabase, langkah 3).
   - **Create** → salin **Client ID** dan **Client secret** (secret hanya tampil sekali; jangan dikirim lewat chat).

## 3. Atur login di Supabase

1. **Authentication → Sign In / Providers → Google**: aktifkan, tempel Client ID dan Client Secret → **Save**.
2. **Authentication → URL Configuration**:
   - **Site URL:** `https://infarm-task-manager.vercel.app`
   - **Redirect URLs:**
     - `https://infarm-task-manager.vercel.app/**`
     - `https://infarm-task-manager-*-<nama-tim-vercel>.vercel.app/**` (alamat preview)
     - `http://localhost:3000/**`

## 4. Jalankan skrip database

1. **SQL Editor → New query**: salin **seluruh** isi [`supabase/schema.sql`](../supabase/schema.sql) → **Run**. Hasilnya "Success. No rows returned". Aman dijalankan ulang.
2. Query baru: salin [`supabase/anggota-awal.sql`](../supabase/anggota-awal.sql), **ganti tiga Gmail contoh dengan Gmail asli** (huruf kecil) → **Run**.
   - Denny dan Arum = `designer`, SPV = `admin`. Nama di sini yang tampil di board dan tombol PIC.

Skrip tadi membuat tabel task, checklist, sesi waktu kerja, riwayat (audit), anggota tim, aturan akses (requester hanya bisa mengirim; board hanya untuk anggota), bucket Storage `references` (foto + PDF maks 5 MB), dan Realtime.

## 5. Vercel

1. **Settings → Environment Variables**, tambahkan (centang **Preview** dulu; **Production** saat siap dipakai):

   | Name | Value |
   |---|---|
   | `REACT_APP_SUPABASE_URL` | Project URL |
   | `REACT_APP_SUPABASE_PUBLISHABLE_KEY` | Publishable key (Supabase → Project Settings → API Keys; diawali `sb_publishable_`) |

2. **Jangan** pakai secret key / service_role key.
3. Variabel baru terpakai di build berikutnya (push ke branch, atau **Redeploy**).
4. Kalau anggota tim ikut mencoba link preview: **Settings → Deployment Protection** → matikan Vercel Authentication untuk Preview.

## 6. Uji coba

1. Buka alamat utama dari HP → isi form dengan 2 foto + 1 PDF + 1 link → **Kirim request** → muncul "Request sudah masuk".
2. Buka `/tim` dari laptop → **Masuk dengan Google** (Gmail anggota). Request tadi ada di kolom **Request** dengan lampiran mini.
3. Coba login dengan Gmail lain yang bukan anggota: harus ditolak dengan pesan "belum terdaftar".
4. Klik **Arum** di kartu → pindah ke On Progress, waktu kerja berjalan. Buka kartu → tambah checklist untuk Denny.
5. Geser kartu ke **Delay**, lalu kembali ke **On Progress**, lalu ke **Finish** (wajib link hasil). Buka detail → **Riwayat** mencatat semua langkah dengan nama pelaku.
6. Dari laptop lain atau tab lain yang login sebagai anggota lain: perubahan muncul tanpa refresh (Realtime).
7. Hapus task → hilang dari board (tetap tersimpan sebagai arsip).

Kalau ada langkah yang gagal, kirim screenshot ke developer.

## 7. Hapus lampiran otomatis (30 hari setelah Finish)

Foto, thumbnail, dan PDF dihapus otomatis **30 hari setelah task masuk Finish** (atau 30 hari setelah task dihapus/diarsipkan). Task, link, checklist, waktu kerja, dan riwayat tetap ada. File "yatim" (upload yang request-nya gagal terkirim, lebih dari 1 hari) ikut dibersihkan. Dikerjakan sekali saja, ±10 menit:

1. **SQL Editor** → jalankan ulang seluruh isi `supabase/schema.sql` terbaru → **Run**.
2. **Edge Functions** (menu kiri) → **Deploy a new function** → **Via Editor**.
   - Nama function: `hapus-lampiran` (persis, huruf kecil).
   - Hapus contoh kode yang ada, lalu tempel seluruh isi [`supabase/functions/hapus-lampiran/index.ts`](../supabase/functions/hapus-lampiran/index.ts) → **Deploy function**.
   - Tidak perlu memasukkan kunci apa pun: Supabase memberi akses ke function ini secara otomatis.
3. **Uji sekali:** buka function `hapus-lampiran` → tombol **Test** (atau **Invoke**) → **Send request**. Hasil yang benar berupa angka, mis. `{"task":0,"file":0,"yatim":0,"gagal":[]}` (0 wajar bila belum ada task yang selesai 30 hari lalu).
4. **Integrations** → **Cron** → **Enable** (sekali), lalu **Create job**:
   - Name: `hapus-lampiran-harian`
   - Schedule: `0 18 * * *` (18.00 UTC = **01.00 WIB** setiap hari)
   - Type: **Supabase Edge Function** → pilih `hapus-lampiran`, method **POST**
   - **Create cron job**.
5. Cek keesokan harinya: **Integrations → Cron → hapus-lampiran-harian → History** menampilkan status *succeeded*, dan di halaman **Usage**, *Edge Function Invocations* bertambah 1 per hari.

Catatan:
- File yang sudah terhapus **tidak bisa dikembalikan**. Kartu dan detail task Finish menampilkan "Lampiran akan dihapus otomatis <tanggal>" sebagai pengingat untuk menyimpan file yang masih dibutuhkan.
- Task yang direvisi (keluar dari Finish) sebelum 30 hari: hitungannya mulai lagi saat Finish berikutnya.
- Paket Free dijeda setelah 7 hari tanpa aktivitas; selama dijeda Cron berhenti. Setelah aktif lagi, semua yang sudah lewat 30 hari diproses pada jadwal berikutnya.
- Untuk mengubah 30 hari: ubah `RETENTION_DAYS` di function **dan** `ATTACHMENT_RETENTION_DAYS` di `src/config.js`, lalu deploy ulang function.

## Catatan

- **Anggota baru:** admin menambahkannya di halaman **Anggota** (`/tim/anggota`) **dan**, bila Google Auth Platform → Audience masih **Testing**, di **Test users**.
- **Setiap ada pembaruan `schema.sql`** (mis. tahap 2 menambah pengaman "minimal satu admin aktif"): salin ulang seluruh isi `supabase/schema.sql` ke SQL Editor → **Run**. Aman dijalankan ulang; data tidak hilang.
- **Anggota keluar tim:** di halaman Anggota hilangkan centang **Aktif** (task dan riwayatnya tetap). Hapus hanya bila perlu; task yang PIC-nya orang itu tetap memakai namanya sampai PIC diganti.
- **Ganti akun uji coba dengan akun asli:** jalankan [`supabase/reset-anggota.sql`](../supabase/reset-anggota.sql) (isi Gmail asli dulu). Di bagian bawahnya ada baris opsional untuk mengosongkan semua task uji coba.
- **Setelah memperbarui kode dari GitHub:** jalankan ulang `supabase/schema.sql` **sebelum** deploy (aman dijalankan ulang). Perubahan 2 Nov 2026 (waktu per kolom) membutuhkan ini.
- **Paket Free** cukup untuk volume tim. Pantau di dashboard Supabase → **Usage**.
- **Proyek dijeda** jika 7 hari tidak dipakai. Kalau situs tidak bisa memuat data setelah libur, buka dashboard Supabase dan klik **Restore project**.
- **Backup:** paket Free tidak menyediakan backup yang bisa diunduh. Gunakan **Export CSV** di board secara berkala.
