# Panduan: lampiran dipindah ke Google Drive

Mulai versi ini, lampiran (foto dan PDF) task **tidak lagi dihapus begitu saja** 30 hari setelah Finish. Petugas
`hapus-lampiran` (Supabase Edge Function, dijalankan Cron setiap hari 01.00 WIB) lebih dulu **menyalinnya ke
Google Drive**, menambahkan link folder Drive ke **Link referensi** task, baru menghapusnya dari Supabase.
Task tidak pernah dihapus. Alur lengkap: mockup artboard 16 dan 16b.

```
Folder induk Anda / 2026-11 / 2026-11-10 · Judul task (Requester, Divisi) / foto-1.jpg, brief.pdf, ...
```

Yang dipasang (sekali saja):

| Bagian | Di mana | Isi |
|---|---|---|
| Apps Script "Arsip lampiran" | script.google.com, akun **pemilik folder** | [`supabase/apps-script/arsip-drive.gs`](../supabase/apps-script/arsip-drive.gs), di-deploy sebagai Web app. **Tanpa trigger.** |
| Script Properties | Apps Script → Project Settings | `ARSIP_TOKEN`, `FOLDER_ID` |
| Secrets | Supabase → Edge Functions → Secrets | `ARSIP_TOKEN` (sama persis), `ARSIP_URL` (link Web app) |
| Kode petugas baru | Supabase → Edge Functions → hapus-lampiran | [`supabase/functions/hapus-lampiran/index.ts`](../supabase/functions/hapus-lampiran/index.ts) |
| Cron | sudah ada (`hapus-lampiran-harian`) | tidak diubah |

> **Penting (tenggat):** kode petugas yang terpasang sekarang masih versi lama (langsung menghapus). Task asli
> pertama genap 30 hari di Finish sekitar **awal Desember 2026**. Pasang kode baru (bagian C) sebelum itu.
> Kode baru aman dipasang lebih dulu: selama `ARSIP_URL`/`ARSIP_TOKEN` belum diisi, **tidak ada lampiran yang
> dihapus** (Logs menulis "ARSIP_URL / ARSIP_TOKEN belum diatur").

---

## A. Siapkan kata sandi bersama dan folder (±3 menit)

1. **Kata sandi bersama (`ARSIP_TOKEN`).** Ini teks acak buatan kita sendiri, **bukan** kata sandi Google.
   Buat di Supabase → **SQL Editor** → jalankan:
   ```sql
   select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') as arsip_token;
   ```
   Salin hasilnya (64 huruf/angka) ke Notepad sementara. Jangan kirim ke chat/WhatsApp.
2. **ID folder induk (`FOLDER_ID`).** Buka folder tujuan di Google Drive (akun pemilik folder). Alamatnya seperti
   `https://drive.google.com/drive/folders/1AbCdEfGh...`. Bagian setelah `/folders/` (sampai sebelum `?` bila ada)
   adalah ID-nya. Salin juga ke Notepad.
3. Pastikan folder itu sudah dibagikan ke Gmail Denny, Arum, dan SPV (minimal **Viewer**). Subfolder yang dibuat
   otomatis mengikuti izin ini.

## B. Pasang Apps Script (±10 menit)

1. Buka https://script.google.com **dengan akun pemilik folder** → **New project**.
2. Klik judul "Untitled project" → ganti menjadi `Arsip lampiran Infarm Design Task`.
3. Di file `Code.gs`, hapus semua isinya, lalu tempel seluruh isi
   [`supabase/apps-script/arsip-drive.gs`](../supabase/apps-script/arsip-drive.gs) (buka file di GitHub →
   tombol **Copy raw file**). Klik ikon **Save** (disket).
4. **Project Settings** (ikon roda gigi di kiri) → gulir ke **Script Properties** → **Add script property**:
   - Property `ARSIP_TOKEN`, Value: kata sandi dari A.1
   - **Add script property** lagi: Property `FOLDER_ID`, Value: ID folder dari A.2
   - **Save script properties**.
5. Kembali ke **Editor** (ikon `< >`). Di bilah atas, pilih fungsi **`cekPengaturan`** → **Run**.
   - Muncul "Authorization required" → **Review permissions** → pilih akun pemilik folder → **Advanced** →
     **Go to Arsip lampiran Infarm Design Task (unsafe)** → **Allow**. (Peringatan "unsafe" normal untuk script
     buatan sendiri.)
   - **Execution log** harus menampilkan `Folder induk: <nama folder>`, `ARSIP_TOKEN: terisi`, `Siap.`
6. **Deploy** (kanan atas) → **New deployment** → ikon roda gigi di "Select type" → **Web app**:
   - Description: `Arsip lampiran v1`
   - Execute as: **Me (email pemilik folder)**
   - Who has access: **Anyone** (Edge Function tidak bisa login Google; pengamannya `ARSIP_TOKEN`)
   - **Deploy** → salin **Web app URL** (berakhiran `/exec`) ke Notepad.
7. Cek: buka Web app URL itu di browser. Harus tampil `{"ok":true,"info":"Arsip lampiran Infarm Design Task aktif"}`.

Bila kelak kode script diubah: **Deploy → Manage deployments → ikon pensil → Version: New version → Deploy**.
Dengan cara ini URL-nya tetap sama (jangan "New deployment", karena URL berubah).

## C. Pasang di Supabase (±5 menit)

1. **Edge Functions → Secrets** → tambah dua secret → **Save**:
   - `ARSIP_URL` = Web app URL dari B.6
   - `ARSIP_TOKEN` = kata sandi dari A.1 (sama persis dengan Script Properties)
2. **Edge Functions → hapus-lampiran → Code** → hapus semua isi `index.ts`, tempel isi terbaru
   [`supabase/functions/hapus-lampiran/index.ts`](../supabase/functions/hapus-lampiran/index.ts) → **Deploy**.
3. **Settings** function itu: pastikan **Verify JWT** tetap **OFF**.
4. Cron `hapus-lampiran-harian` yang sudah ada **tidak perlu diubah**.

Setelah ini, notepad berisi kata sandi boleh dihapus (nilainya sudah tersimpan di dua tempat tadi).

---

## D. Uji di database production (tanpa mengganggu task asli)

Petugas punya **mode uji**: bila dipanggil dengan body `{"uji": true}`, ia **hanya** memproses task yang judulnya
diawali `[TESTING]` dan tidak menjalankan bersih-bersih. Task asli tidak mungkin ikut, kapan pun dijalankan.

Sebelum mulai: kabari tim desain bahwa akan ada task `[TESTING]` (mereka akan melihat banner "request baru").

### D.1 Buat Cron uji (sementara)
**Integrations → Cron → Jobs → Create job**:
- Name: `uji-arsip-drive`
- Schedule: `0 0 1 1 *` (setahun sekali; kita menjalankannya manual, nanti dihapus)
- Type: **Supabase Edge Function** → Method **POST** → Edge Function `hapus-lampiran` → Timeout `5000`
- HTTP Headers: panah di sebelah **Add header** → **Add secret key**
- HTTP Request Body: `{"uji": true}`
- **Create cron job**

### D.2 Kirim request uji lewat form
Buka https://infarm-task-manager.vercel.app/ dan isi:
- Judul: `[TESTING] Uji pindah lampiran ke Drive` (harus diawali `[TESTING]`, dengan kurung siku)
- Nama requester: `Testing`, divisi bebas, deadline bebas
- Lampiran: 2 foto + 1 PDF → **Kirim**

### D.3 Jadikan "sudah Finish 31 hari lalu" (SQL Editor)
Jalankan berurutan (dua query terpisah):
```sql
update public.tasks set status = 'finish', pic = 'Testing'
where title like '[TESTING]%' and status = 'request';
```
```sql
update public.tasks
set finished_at = now() - interval '31 days', created_at = now() - interval '32 days'
where title like '[TESTING]%';
```
Cek: `select title, status, finished_at, jsonb_array_length(attachments) as lampiran from public.tasks where title like '[TESTING]%';`
→ status `finish`, tanggal ±31 hari lalu, lampiran `3`.

### D.4 Jalankan mode uji
**Integrations → Cron → Jobs** → titik tiga di `uji-arsip-drive` → **Run command**. Tunggu ±30 detik, lalu
**Edge Functions → hapus-lampiran → Logs**. Yang diharapkan:
```
hapus-lampiran {"mode":"uji","task":1,"file":3,"yatim":0,"sisa":0,"gagal":[]}
```
(Jawaban ke Cron sendiri berupa `{"mulai":true,...}`; hasil sebenarnya selalu di Logs.)

### D.5 Tampilkan lagi di kolom Finish (supaya tim bisa melihat)
Task yang selesai > 30 hari tidak tampil di board. Kembalikan tanggal selesainya ke hari ini:
```sql
update public.tasks set finished_at = now() where title like '[TESTING]%';
```

### D.6 Periksa hasilnya
- **Google Drive:** folder induk → folder bulan dari tanggal selesai (31 hari lalu, mis. `2026-10`) → subfolder
  `… · [TESTING] Uji pindah lampiran ke Drive (Testing, …)` berisi 2 foto + 1 PDF yang bisa dibuka.
- **Board** (kolom Finish): kartu bertuliskan "Lampiran ada di Google Drive (3 file)".
- **Detail task:** di bagian Lampiran "3 lampiran dipindah ke Google Drive pada …" + "Buka folder Google Drive";
  di Link referensi ada baris "Lampiran (Google Drive)"; Riwayat: "sistem memindah lampiran ke Google Drive".
- **Supabase → Storage → references:** folder dengan ID task uji sudah tidak ada/berisi file.
  (ID task: `select id from public.tasks where title like '[TESTING]%';`)

Minta pendapat tim desain di tahap ini.

### D.7 (Opsional) Uji jalur gagal
1. Kirim request uji kedua (judul `[TESTING] Uji gagal`), lalu ulangi D.3 untuk task itu.
2. **Edge Functions → Secrets** → ubah sementara `ARSIP_TOKEN` menjadi `salah` → Save.
3. Run command `uji-arsip-drive` → Logs harus `"task":0` dan `"gagal":["[TESTING] Uji gagal: Apps Script: kata sandi salah"]`.
   Storage: file task kedua **masih ada**; detail task: lampiran masih tampil.
4. Kembalikan `ARSIP_TOKEN` yang benar → Run command lagi → kali ini berhasil (`"task":1`).

### D.8 Bersihkan
```sql
-- cek dulu: harus hanya task uji
select id, title from public.tasks where title like '[TESTING]%';
```
```sql
-- hapus permanen task uji (riwayat, waktu kerja, checklist, tanda "dibaca" ikut terhapus)
delete from public.tasks where title like '[TESTING]%';
```
- Google Drive: hapus subfolder `[TESTING]` (dan folder bulan bila kosong).
- **Integrations → Cron → `uji-arsip-drive`** → titik tiga → **Delete**.
- Bila uji D.7 tidak selesai sampai berhasil, Storage mungkin masih berisi folder task uji kedua: file itu
  dibersihkan otomatis oleh petugas harian sebagai "file yatim" (> 1 hari).

---

## E. Sehari-hari

- Setiap pagi tidak perlu dicek. Bila ingin: **Edge Functions → hapus-lampiran → Logs** → baris
  `hapus-lampiran {"mode":"normal","task":…,"gagal":[]}`. `gagal` kosong = semua beres.
- Bila `gagal` berisi pesan:
  - `ARSIP_URL / ARSIP_TOKEN belum diatur`: secret belum diisi (C.1). Tidak ada yang dihapus.
  - `Apps Script: kata sandi salah`: `ARSIP_TOKEN` di Supabase dan Script Properties tidak sama.
  - `Apps Script tidak menjawab JSON`: Web app belum di-deploy sebagai **Anyone**, atau URL salah.
  - Semua kegagalan sebelum file dihapus akan **dicoba lagi besok** otomatis; file asli tetap aman.
- Maks 15 task per malam (sisanya malam berikutnya).
- Task yang direvisi (keluar dari Finish) sebelum 30 hari: hitungannya mulai lagi dari Finish berikutnya.
- Lampiran baru yang ditambahkan ke task setelah dipindah: dipindah lagi 30 hari setelah Finish berikutnya,
  ke subfolder Drive yang sama.
