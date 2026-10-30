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

## Catatan

- **Anggota baru:** tambahkan Gmail-nya di Google (Test users) **dan** di tabel `team_members` (tahap 2: lewat halaman Anggota).
- **Paket Free** cukup untuk volume tim. Pantau di dashboard Supabase → **Usage**.
- **Proyek dijeda** jika 7 hari tidak dipakai. Kalau situs tidak bisa memuat data setelah libur, buka dashboard Supabase dan klik **Restore project**.
- **Backup:** paket Free tidak menyediakan backup yang bisa diunduh. Gunakan **Export CSV** di board secara berkala.
