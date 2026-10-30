# CLAUDE.md

Panduan untuk Claude (dan developer) saat bekerja di repo ini.

## Ringkasan proyek

**Infarm Design Task Manager**: aplikasi web internal untuk mengelola request desain grafis di INFARM.ID.
Divisi lain (Sales, Bidev, HRD, Marketing, Management, FAT, dll.) mengirim request lewat form publik.
Tim Desain (Denny & Arum) memproses task di papan Kanban internal sampai selesai; SPV memantau sebagai admin.

- Live: https://infarm-task-manager.vercel.app/
- Hosting: Vercel (auto-deploy dari GitHub)
- Bahasa UI dan komentar kode: Bahasa Indonesia
- Mockup UI/UX (acuan tampilan): https://claude.ai/artifact/X2yJtpb2ETevn9AR56V5nu

> **Status:** spesifikasi di bawah adalah **v8** (disepakati dengan pemilik proyek, 30 Oktober 2026).
> Kode di branch masih **v7** (PIN bersama, halaman status publik, kolom Todo, edit oleh requester).
> Perbedaannya ada di bagian "Dari v7 ke v8". Saat mengubah kode, ikuti v8.

## Peran dan akses

| Peran | Siapa | Masuk | Bisa |
|---|---|---|---|
| Requester | divisi lain | tanpa login | Mengisi form request. Setelah terkirim hanya melihat konfirmasi; **tidak** bisa melihat board, progres, atau mengedit request. |
| Tim desain | Denny, Arum | login Google (Gmail) | Semua aksi task di board; tampilan sama untuk keduanya. |
| Admin | SPV | login Google (Gmail) | Semua hak tim desain + kelola email yang boleh login, pulihkan task terhapus, halaman audit lengkap. |

- Hanya email di daftar anggota (tabel `team_members`, dikelola admin) yang bisa masuk. Akun Google lain ditolak dengan pesan jelas.
- Board, checklist, riwayat, dan waktu kerja **dikunci di database** (RLS), bukan hanya disembunyikan di UI. Requester (`anon`) hanya boleh `INSERT` request dan meng-upload lampiran; tidak boleh membaca apa pun.
- Pilihan PIC = anggota aktif berperan desainer (admin tidak muncul sebagai PIC).

## Alur kerja (v8)

1. **Form request** (`/`): nama, divisi, judul, kategori, deadline, brief (task secara keseluruhan), link referensi, dan **lampiran maks 5 file**:
   - Gambar JPG/PNG/WEBP: dikompres otomatis (maks 1600px) + dibuatkan **thumbnail kecil** (±320px) untuk kartu, supaya board tidak memboroskan kuota transfer.
   - PDF: maks **5 MB** per file, tampil sebagai ikon + nama file.
   - Setelah terkirim: halaman "Request sudah masuk" (ringkasan isian dari form). Tidak ada link ke progres.
2. **Notifikasi request baru** (di dalam web, **tanpa lonceng**):
   - **Banner hijau tetap** di atas board: "2 request baru masuk · Lihat". Tidak hilang sendiri sampai diklik.
   - **Kartu baru disorot**: badge "Baru" + garis tepi berkedip halus sampai detailnya dibuka.
   - Status "sudah dilihat" dicatat **per akun** (Denny melihat tidak menghilangkan tanda untuk Arum).
3. **Kolom Kanban: Request → On Progress → Delay → Finish** (tidak ada Todo).
   - **Request:** kartu punya tombol nama desainer langsung (**Arum** / **Denny**). Klik = jadi PIC + pindah ke On Progress + waktu kerja mulai. PIC tidak ditentukan dari siapa yang login.
   - **On Progress:** sedang dikerjakan; waktu kerja berjalan.
   - **Delay:** ditunda **manual** karena menunggu sesuatu (mis. bahan dari requester). Waktu kerja berhenti selama di Delay.
   - **Finish:** wajib minimal satu **link hasil**. Waktu kerja berhenti.
   - **Terlambat** (lewat deadline) bukan kolom: badge merah di kolom mana pun kecuali Finish.
   - **Urutan kartu:** deadline terdekat paling atas (Request, On Progress, Delay). Finish: yang terakhir selesai paling atas.
4. **Pindah kolom maju dan mundur** lewat **geser kartu** (desktop) dan tombol **"Pindah ke…"** (desktop dan HP):
   - Dari Request ke kolom lain tanpa PIC: dialog pilih PIC dulu.
   - Ke Finish: dialog link hasil (wajib).
   - Finish → On Progress/Delay = **revisi**; waktu kerja melanjutkan total sebelumnya.
   - Ke Request: PIC dilepas; waktu yang sudah tercatat tetap disimpan.
5. **Kerja bersama:** satu task bisa dikerjakan Denny dan Arum. PIC tetap satu (penanggung jawab: pindah kolom, isi link hasil). Tim membagi **checklist** di detail task; tiap item punya pengerja (`assignee`). Tidak ada link per item checklist; link referensi per task.
6. **Waktu kerja (time tracking):**
   - Dihitung hanya **jam kerja Senin–Jumat 08.00–17.00 WIB**, selama task di **On Progress**. Berhenti di Delay, Finish, dan Request; revisi menambah ke total.
   - Tampil di kartu dan detail sebagai **jam dan menit**, mis. "20 jam 15 menit".
   - **Task bersama:** satu durasi per task. Di analitik, durasi itu dihitung untuk PIC **dan** setiap pengerja checklist, dengan tanda "dikerjakan bersama".
   - Hari libur nasional belum diperhitungkan (bisa ditambah daftar libur nanti).
7. **Lampiran dihapus otomatis 7 hari setelah Finish** (foto dan PDF, termasuk thumbnail). Baris task, link referensi, dan link hasil tetap ada; kartu menampilkan "Lampiran dihapus otomatis". Kalau task direvisi sebelum 7 hari, hitungan batal dan dimulai lagi saat Finish berikutnya.
8. **Detail task = pop-up mengambang** di tengah layar (HP: layar penuh), dibuka dengan klik kartu.
   - Kanan atas: ikon **hijau Edit**, **merah Hapus** (dengan konfirmasi), **abu-abu Tutup**.
   - Isi: info request, lampiran, link referensi, checklist per orang, link hasil, waktu kerja, riwayat task, aksi pindah kolom.
   - Hanya tim desain/admin yang bisa mengedit isi request.
9. **Hapus = arsip** (soft delete). Task hilang dari board, tetap ada di database beserta riwayatnya; admin bisa memulihkan.
10. **Audit / riwayat perubahan:** semua perubahan dicatat otomatis oleh database beserta **akun Google pelakunya**: dibuat, edit field, pindah kolom, ganti PIC, checklist, lampiran, link hasil, hapus/pulihkan, dan penghapusan lampiran otomatis (pelaku "sistem"). Riwayat tidak bisa diubah atau dihapus siapa pun. Tampil di detail task; halaman audit lengkap untuk admin.
11. **Pencarian judul** di bagian paling atas board (search bar di header hijau).
12. **Analitik per orang:** task selesai, persen tepat waktu, rata-rata waktu kerja per task, jumlah Delay. Bisa dibandingkan dengan **minggu lalu** atau **bulan lalu** (naik/turun ditampilkan).

## Struktur link (v8)

| Path | Untuk | Isi |
|---|---|---|
| `/` | requester | Form request, lalu "Request sudah masuk" |
| `/request` | requester | Link lama: dialihkan ke `/` (juga `/#/request`) |
| `/tim` | tim + admin | Login Google, lalu board Kanban |
| `/tim/task/:id` | tim + admin | Board dengan pop-up detail task terbuka (deep link) |
| `/tim/analitik` | tim + admin | Analitik per orang + perbandingan periode |
| `/tim/audit` | admin | Riwayat semua perubahan + task terhapus (pulihkan) |
| `/tim/anggota` | admin | Kelola email yang boleh login dan perannya |

Pakai React Router (path asli) + rewrite di `vercel.json`.

## Tech stack

- React 18 (function component + Hooks), JavaScript/JSX, tanpa TypeScript
- Create React App (`react-scripts` 5.0.1)
- React Router 6 (path asli; rewrite SPA di `vercel.json`)
- Ikon: `lucide-react` (sesuai design system Infarm)
- Styling: `src/styles.css` dengan CSS variables dari design system Infarm (brand-primary `#00843b`, brand-surface `#f5ffef`, soil `#6b4e3d`, cream `#ede3d0`, Montserrat untuk heading, Geist untuk teks). Breakpoint HP: 720px.
- Penyimpanan: **Supabase** (`@supabase/supabase-js`) bila `REACT_APP_SUPABASE_URL` + key diatur; kalau tidak, **mode uji coba** `localStorage`. Pemilihan otomatis di `src/data/taskStore.js`.
- v8 menambah: **Supabase Auth (Google)**, geser kartu dengan pustaka drag and drop yang mendukung sentuhan dan keyboard (rencana: `@dnd-kit`), dan tugas terjadwal harian untuk menghapus lampiran (Supabase Edge Function terjadwal; file Storage harus dihapus lewat Storage API, bukan `delete from storage.objects`).
- `api/request.js`: Vercel Serverless Function lama untuk Google Apps Script. Tidak dipakai frontend dan tidak menyimpan data.

## Perintah

```bash
npm install
npm start        # dev server CRA (http://localhost:3000)
npm run build    # build produksi ke /build (CI=true: warning ESLint dianggap error)
```

Environment variable (atur di Vercel → Settings → Environment Variables):

- `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_PUBLISHABLE_KEY` (atau `REACT_APP_SUPABASE_ANON_KEY`): koneksi Supabase. Keduanya aman di browser. Jangan pernah memakai secret/service_role key di frontend.
- v7: PIN tim diatur lewat `supabase/set-pin.sql`; `REACT_APP_TEAM_PIN_SHA256` hanya untuk mode uji coba. Di v8 PIN diganti login Google (Client ID/Secret Google diatur di Supabase → Authentication → Providers, bukan di Vercel).

Langkah menyiapkan Supabase untuk pemilik proyek: `docs/PANDUAN-SUPABASE.md` (perlu ditambah langkah Google OAuth di v8).

Belum ada test otomatis. Uji manual minimal v8: kirim request dengan 2 foto + 1 PDF + link; banner dan badge "Baru" muncul di board; Ambil lewat tombol Arum/Denny; checklist dibagi dua orang; geser ke Delay (waktu berhenti) lalu kembali; Finish (wajib link); revisi dari Finish; cek riwayat dan audit; cek tampilan HP (lebar 390px).

## Model data (v8)

```js
// tasks: 1 baris = 1 request desain
{
  id, title, category, division, requesterName, description, dueDate: "YYYY-MM-DD",
  status: "request" | "on_progress" | "delay" | "finish",
  pic: string | null,                    // wajib selain status request
  delayReason: string | null,            // opsional, diisi saat pindah ke Delay
  attachments: [{ id, name, size, type: "image" | "pdf", path, url, thumbPath?, thumbUrl? }],  // maks 5
  referenceLinks: [{ id, url }],
  resultLinks: [{ id, url }],            // wajib ≥1 saat finish
  checklist: [{ id, text, done, assignee, doneAt, position }],   // tabel task_checklist
  workMinutes: number,                   // total menit jam kerja (dihitung dari work_sessions)
  createdAt, startedAt, finishedAt, attachmentsDeletedAt, deletedAt, updatedAt,
}
```

Tabel Supabase v8:

- `tasks`: kolom di atas (snake_case). Constraint: `tasks_pic_wajib`, `tasks_link_hasil_wajib`. `deleted_at`/`deleted_by` untuk arsip.
- `task_checklist`: 1 baris per item (sudah ada di v7).
- `work_sessions`: `task_id`, `started_at`, `ended_at` (null = sedang berjalan). Dibuka saat masuk On Progress, ditutup saat keluar. Menit dihitung hanya jam kerja Senin–Jumat 08.00–17.00 WIB (fungsi SQL, sama dengan fungsi JS untuk tampilan berjalan).
- `task_history`: audit, ditulis trigger database. `actor_email`, `actor_name` (requester: nama dari form; otomatis: "sistem"), `action`, `changes [{field, before, after}]`. Tidak ada izin UPDATE/DELETE untuk siapa pun.
- `task_reads`: `task_id`, `member_email`, `read_at` (badge "Baru" per akun).
- `team_members`: `email` (Gmail), `name`, `role: "designer" | "admin"`, `active`, `color`.
- Storage bucket `references`: `<id task>/<file>` untuk foto, thumbnail, dan PDF (maks 5 MB, JPG/PNG/WEBP/PDF).

Migrasi v7 → v8 (di `schema.sql`, idempotent, wajib diuji dengan data v7): `todo` → `on_progress` (sesi kerja dimulai saat migrasi), `reference_images` → `attachments`, kolom edit requester (`requester_updated_at`, `pic_seen_at`) dan fungsi PIN/requester dihapus, riwayat lama tetap (`actor` "tim" → `actor_name` "tim (sebelum login)").

## Aturan tata letak UI (v8, acuan: mockup)

1. **Header hijau** (gradasi hijau Infarm): logo + judul kiri.
   - Tim: **search bar judul** di tengah; kanan: Salin link form · Export CSV · avatar akun (menu: nama, email, Keluar). HP: ikon cari + avatar; Salin link form dan Export CSV pindah ke menu akun.
   - Form request: hanya logo + judul, tanpa tombol.
2. **Banner request baru** tepat di bawah header (hanya bila ada yang belum dilihat akun ini).
3. **Urutan halaman tim:**
   - Kanban: tab Kanban · Analitik (admin: + Audit · Anggota) → 5 chip angka (Request, On Progress, Delay, Terlambat, Selesai 30 hari) → filter (Tugas saya/Semua, PIC, deadline) → 4 kolom Kanban (HP: satu kolom, dipilih lewat tombol kolom).
   - HP: tab diganti **menu bawah** (Kanban · Analitik · Akun; admin: Kanban · Analitik · Admin).
   - Analitik: tab → periode + pembanding (minggu lalu / bulan lalu) → kartu per orang → per kategori/divisi.
   - Di HP, chip angka jadi satu baris yang bisa digeser.
4. **Anatomi kartu:** badge (Baru / Terlambat) + deadline di kanan → judul → kategori · requester (divisi) → lampiran mini (maks 3 thumbnail + "+2", PDF sebagai ikon) → PIC + "bersama …" → waktu kerja → progres checklist → aksi (Request: tombol Arum/Denny; lainnya: "Pindah ke…").
5. **Detail pop-up:** maks 760px di tengah dengan latar redup (HP: layar penuh). Kanan atas: Edit (hijau), Hapus (merah), Tutup (abu-abu). Aksi pindah kolom di bawah.
6. **Desktop dan HP memakai komponen yang sama**; HP hanya beda ukuran sentuh (44px) dan susunan menumpuk. Dialog di HP muncul dari bawah dengan tombol utama di atas.
7. **Lebar konten:** halaman tim 1400px, form request 1040px (halaman terkirim 760px).
8. **Skala:** teks 13px, judul 15–18px, angka 20px; tombol 36px (HP 44px), CTA 42px (HP 48px), input 38px (HP 44px).
9. **Warna:** hijau Infarm untuk aksi utama dan status aktif; soil/cream untuk Arum dan label kategori; merah hanya untuk Terlambat/Hapus. Kolom: Request abu-abu · On Progress soil · Delay amber · Finish hijau. Lampiran di kartu: foto cream, PDF merah muda. Status selalu ada label teks, bukan hanya warna.

## Pola dan konvensi kode

- Komponen tidak pernah memanggil Supabase/localStorage langsung: baca lewat `useTasks()`, ubah lewat fungsi di `taskActions.js`.
- Kolom baru di task: tambah di `schema.sql` (tabel + `alter table ... add column if not exists`), `taskModel.js` (`normalizeTask`, `COLUMNS`), lalu UI. Audit ditulis oleh trigger, jadi kolom baru otomatis tercatat bila didaftarkan di fungsi pembanding riwayat.
- Aksi dijalankan lewat `useAction(showToast)` → `run(() => aksi(...), "pesan sukses")`. Error otomatis jadi toast, dan data di layar tidak berubah.
- `taskStore` memperbarui cache hanya SETELAH penulisan berhasil.
- Desainer baru (v8): ditambah admin di halaman Anggota (tabel `team_members`), bukan di kode.
- Teks UI Bahasa Indonesia, sentence case, tanpa emoji (aturan design system Infarm). Status selalu ada label teks, bukan hanya warna.
- Link diketik tanpa `https://` tetap diterima: pakai `normalizeUrl`, dan input link memakai `type="text" inputMode="url"`.
- Waktu kerja: satu fungsi perhitungan jam kerja di SQL dan padanannya di JS (untuk angka berjalan di layar) harus selalu sama.

## Dari v7 ke v8 (rencana perubahan kode)

| Bagian | v7 (kode sekarang) | v8 |
|---|---|---|
| Akses tim | PIN bersama (`team_*` RPC + `app_settings`) | Login Google + `team_members`, RLS `authenticated` |
| Requester | Halaman status publik `/` + edit `/request/:id/edit` | Hanya form `/`; tidak bisa melihat/mengedit |
| Kolom | Request, Todo, On Progress, Finish | Request, On Progress, Delay, Finish |
| Pindah kolom | Tombol per tahap | Geser kartu + "Pindah ke…" (maju/mundur) |
| Lampiran | Gambar saja, maks 6, hapus manual saat Finish | Gambar + PDF, maks 5, thumbnail, hapus otomatis 7 hari setelah Finish |
| Detail | Panel kanan 480px | Pop-up tengah + ikon Edit/Hapus/Tutup |
| Riwayat | actor "requester"/"tim" | Akun Google pelaku, semua perubahan, tidak bisa diubah; halaman audit admin |
| Hapus task | Permanen | Arsip, bisa dipulihkan admin |
| Notifikasi | Tidak ada | Banner + kartu "Baru" per akun |
| Waktu kerja | Tidak ada | Jam kerja Senin–Jumat 08–17, berhenti di Delay |
| Analitik | Per desainer, periode | + per orang dibanding minggu/bulan lalu, rata-rata waktu kerja |

File v7 yang akan dihapus/diganti: `src/pages/StatusPage.js`, `src/pages/EditRequestPage.js`, `src/lib/pin.js`, `supabase/set-pin.sql`, layar PIN di `team/TeamLayout.js`, `team/TaskDetail.js` (jadi pop-up).

## Struktur file (kode saat ini, v7)

```
public/index.html          title, viewport, font Google (Geist, Montserrat)
public/logo-infarm.png     logo + favicon
vercel.json                rewrite semua path (kecuali /api) ke index.html
src/index.js               entry: BrowserRouter + styles.css
src/App.js                 routing + redirect link lama "/#/request"
src/config.js              DESIGNERS (nama + warna), CATEGORIES, DIVISIONS, STATUS, PIN hash, STORAGE_MODE
src/styles.css             semua style (token Infarm, komponen, responsive)
supabase/schema.sql        skema database v7, RLS, fungsi RPC tim (cek PIN) & requester, bucket Storage, Realtime.
                           Idempotent; juga meng-upgrade database v6 (checklist jsonb → tabel task_checklist).
supabase/set-pin.sql       atur/ganti PIN tim (disimpan sebagai hash)
docs/PANDUAN-SUPABASE.md   panduan non-teknis menyiapkan Supabase + Vercel
src/data/
  taskStore.js             pintu masuk data: memilih supabaseStore atau localStore sesuai STORAGE_MODE
  supabaseStore.js         CRUD via Supabase, upload/hapus gambar, Realtime (tasks + task_checklist)
  localStore.js            CRUD via localStorage (mode uji coba) + riwayat lokal + migrasi v5→v6
  taskModel.js             normalizeTask, fromRow/toRow, taskChanges/historyAction, isUpdatedByRequester, helpers, involves
  taskActions.js           aksi alur kerja (submitRequest, editRequest, assignTask, startTask, finishTask, reviseTask, markSeen, checklist, ...)
  useTasks.js              hook React: daftar task yang ikut berubah otomatis
src/lib/
  dates.js                 tanggal, overdue, deadline dekat, tepat waktu, rentang periode analitik
  images.js                kompres gambar (maks 1600px, JPEG 0.8), fmtBytes, newId
  links.js                 normalizeUrl, displayUrl
  csv.js                   export CSV (RFC 4180 + BOM untuk Excel)
  changes.js               teks riwayat perubahan
  pin.js                   PIN tim (dihapus di v8)
src/components/
  ui.js                    AppHeader, LocalModeBanner, StatusBadge, Avatar, Stepper, Modal, Lightbox, ReferenceList, useToast, useAction
  ReferenceEditor.js       input gambar + link referensi
src/pages/
  StatusPage.js            "/" status semua request (dihapus di v8)
  RequestPage.js           "/request" form + konfirmasi
  EditRequestPage.js       "/request/:id/edit" edit oleh requester (dihapus di v8)
  team/TeamLayout.js       "/tim/*" layar PIN, header, tab Kanban/Analitik
  team/BoardPage.js        Kanban, filter, statistik, beban kerja
  team/TaskCard.js         kartu Kanban
  team/TaskDetail.js       panel detail (jadi pop-up di v8)
  team/FinishDialog.js     dialog Finish: wajib link hasil
  team/AnalyticsPage.js    analitik
```

## Masalah yang diketahui

- **Mode uji coba** (tanpa env Supabase): data hanya di browser; banner "Mode uji coba" tampil. Di v8, login Google hanya berjalan di mode Supabase; mode uji coba memakai pilihan akun tiruan.
- **Daftar task dibatasi 500 terbaru** (`LIST_LIMIT` di `supabaseStore.js`). Tambahkan paginasi bila task lebih banyak.
- **Realtime mengambil ulang seluruh daftar** setiap ada perubahan (jeda 300 ms). Cukup untuk volume tim.
- **File yatim** bisa tersisa jika upload berhasil tapi simpan task gagal. Penghapus lampiran terjadwal v8 sebaiknya juga membersihkan file tanpa task.
- **Supabase Free dijeda** setelah 7 hari tanpa aktivitas; tugas terjadwal ikut berhenti selama dijeda.

## Integrasi Supabase

- v7 (kode sekarang): requester `SELECT` semua task + `INSERT` request + `requester_update_task`; tim lewat RPC `team_*` ber-PIN; Storage hanya boleh menghapus gambar task Finish/terhapus/tidak dipakai. Uji SQL lokal: Postgres 16 + stub role `anon`/`authenticated`, schema `storage`, publication `supabase_realtime`; uji upgrade dengan membandingkan `pg_dump -s` database baru vs hasil upgrade.
- v8: requester hanya `INSERT` (tanpa membaca balik; konfirmasi memakai isian form), anggota tim `SELECT/UPDATE` lewat RLS berbasis `auth.email()` ∈ `team_members`, audit lewat trigger (`security definer`), admin-only untuk `team_members`, pemulihan arsip, dan halaman audit.
