# Panduan menghubungkan Supabase

Panduan ini untuk pemilik proyek. Kode aplikasi sudah siap; langkah di bawah hanya pengaturan akun, database, dan Vercel. Perkiraan waktu: 20–30 menit.

Selama langkah 5 belum selesai, aplikasi tetap berjalan dalam **mode uji coba** (data hanya di browser masing-masing, ada banner oranye).

## 1. Buat akun dan proyek Supabase

1. Buka https://supabase.com, klik **Start your project**, lalu daftar (bisa dengan akun GitHub atau email kantor).
2. Klik **New project**.
   - **Name:** `infarm-task-manager`
   - **Database password:** buat password kuat dan simpan di tempat aman (tidak dipakai aplikasi, tapi dibutuhkan untuk administrasi).
   - **Region:** pilih **Southeast Asia (Singapore)** supaya cepat dari Indonesia.
   - **Plan:** Free.
3. Tunggu sampai proyek selesai dibuat (sekitar 1–2 menit).

## 2. Jalankan skrip database

1. Di dashboard proyek, buka **SQL Editor** → **New query**.
2. Buka file [`supabase/schema.sql`](../supabase/schema.sql) di repo ini, salin **seluruh** isinya, tempel ke SQL Editor, lalu klik **Run**.
   - Hasilnya harus "Success. No rows returned". Kalau ada error, kirim pesan error-nya ke developer.
   - Skrip ini aman dijalankan ulang.
3. Skrip tadi sekaligus membuat:
   - tabel `tasks` beserta aturan alur kerja (PIC wajib, link hasil wajib),
   - tabel `task_checklist` (checklist per item, bisa dibagi ke Denny dan Arum) dan `task_history` (riwayat perubahan),
   - aturan akses (requester hanya bisa melihat, mengirim request, dan mengedit request yang belum dikerjakan; perubahan tim wajib PIN),
   - bucket Storage `references` untuk gambar referensi (maks 2 MB per file, hanya JPG/PNG/WEBP),
   - Realtime supaya board dan halaman status ikut berubah otomatis.

### Sudah pernah menjalankan schema.sql versi sebelumnya?

Cukup jalankan **ulang** `supabase/schema.sql` yang terbaru dengan cara yang sama. Skrip mendeteksi database lama, memindahkan checklist yang sudah ada ke tabel baru tanpa kehilangan data, lalu menambah kolom dan fungsi baru. Task, gambar, dan PIN yang sudah ada tidak berubah. Setelah itu deploy ulang aplikasi (langkah 5) supaya kode baru terpakai.

## 3. Atur PIN tim

1. Masih di **SQL Editor**, buat query baru.
2. Salin isi [`supabase/set-pin.sql`](../supabase/set-pin.sql), **ganti `123456` dengan PIN 6 angka pilihan Anda**, lalu **Run**.
3. Bagikan PIN ini hanya ke Denny dan Arum.

Untuk mengganti PIN nanti, jalankan file yang sama dengan PIN baru. Semua perangkat tim otomatis diminta memasukkan PIN baru.

## 4. Ambil alamat dan key proyek

1. Buka **Project Settings** (ikon roda gigi) → **API Keys** (di beberapa versi dashboard: **Data API** / **API**).
2. Catat dua nilai:
   - **Project URL**, contoh `https://abcdefghijkl.supabase.co`
   - **Publishable key** (diawali `sb_publishable_…`). Kalau yang ada hanya key lama, pakai **anon public key**.
3. **Jangan** pakai **secret key** / **service_role key**. Key itu tidak boleh dimasukkan ke aplikasi.

## 5. Masukkan ke Vercel lalu deploy ulang

1. Buka https://vercel.com → proyek **infarm-task-manager** → **Settings** → **Environment Variables**.
2. Tambahkan dua variabel (centang **Production** dan **Preview**):

   | Name | Value |
   |---|---|
   | `REACT_APP_SUPABASE_URL` | Project URL dari langkah 4 |
   | `REACT_APP_SUPABASE_PUBLISHABLE_KEY` | Publishable key (atau anon key) dari langkah 4 |

3. Variabel `REACT_APP_TEAM_PIN_SHA256` tidak dipakai lagi di mode Supabase; boleh dihapus.
4. Buka tab **Deployments**, klik titik tiga pada deployment terbaru → **Redeploy**. Variabel baru baru terpakai setelah deploy ulang.

## 6. Uji coba

1. Buka situs dari **HP** (pakai data seluler, bukan Wi-Fi kantor) → **Buat request baru** → isi form dengan 1 gambar dan 1 link → **Kirim request**.
2. Buka `/tim` dari **laptop** → masukkan PIN. Request dari HP harus muncul di kolom **Request** tanpa perlu refresh.
3. Klik **Ambil**, **Mulai kerjakan**, lalu **Selesai, kirim link hasil** dengan sebuah link.
4. Di HP, buka halaman status: request tadi harus berstatus **Finish** dengan tombol **Buka hasil desain**.
5. Kirim request baru lagi, lalu di halaman status klik **Edit request**, ubah deadline, dan **Simpan perubahan**. Di `/tim`, kartunya harus menampilkan badge **Diperbarui requester**, dan detail task menampilkan **Perubahan dari requester**.
6. Banner oranye "Mode uji coba" sudah tidak muncul.

Kalau ada langkah yang gagal, kirim screenshot ke developer.

## Catatan

- **Data lama** dari mode uji coba (tersimpan di browser masing-masing) tidak otomatis pindah ke Supabase. Kalau ada request penting, kirim ulang lewat form.
- **Paket Free** cukup untuk volume tim (lihat perhitungan di diskusi sebelumnya). Pantau pemakaian di dashboard Supabase → **Usage**.
- **Proyek dijeda** jika 7 hari tidak dipakai (misalnya saat libur panjang). Kalau situs tidak bisa memuat data setelah libur, buka dashboard Supabase dan klik **Restore project**.
- **Backup**: paket Free tidak menyediakan backup yang bisa diunduh. Gunakan **Export CSV** di board secara berkala.
