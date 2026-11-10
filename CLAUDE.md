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
> Dikerjakan bertahap, lihat "Tahapan v8". **Tahap 1, tahap 2, dan notifikasi request baru sudah di kode**; sisanya (tahap 3) belum.

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
   - Setelah terkirim: halaman "Request sudah masuk" (ringkasan isian dari form + pratinjau foto yang bisa diperbesar dan digeser, PDF bisa dibuka; diambil dari file di perangkat requester, bukan diunduh ulang). Tidak ada link ke progres.
2. **Notifikasi request baru** (di dalam web, **tanpa lonceng**):
   - **Banner hijau tetap** di atas board: "2 request baru masuk · Lihat". Tidak hilang sendiri sampai diklik.
   - **Kartu baru disorot**: badge "Baru" + garis tepi berkedip halus sampai detailnya dibuka.
   - Status "sudah dilihat" dicatat **per akun** (Denny melihat tidak menghilangkan tanda untuk Arum).
   - "Baru" = task di kolom Request yang belum pernah dibuka akun itu (`task_reads`). Banner menampilkan yang masuk setelah "Lihat" terakhir diklik (waktu klik disimpan per akun di localStorage `infarm_banner_seen_<email>`).
   - Board mengambil ulang data tiap 60 detik selama tab terlihat, sebagai cadangan bila Realtime terputus.
3. **Kolom Kanban: Request → On Progress → Delay → Finish** (tidak ada Todo).
   - **Request:** PIC ditentukan di sini (diubah 2 Nov 2026). Kartu tanpa PIC punya tombol nama desainer (**Arum** / **Denny**): klik = jadi PIC, kartu **tetap di Request**. PIC bisa diganti selama masih di Request (tombol "Ganti PIC ke …" di kartu, pilihan PIC di detail).
   - **Mulai kerjakan** (Request → On Progress, juga geser kartu / "Pindah ke…"): **hanya akun PIC itu sendiri atau admin**. Akun lain melihat tombol nonaktif + "Hanya <PIC> (PIC) atau admin yang bisa memulai task ini." Desainer yang memindah task tanpa PIC otomatis menjadi PIC; admin memilih PIC di dialog. Dikunci di database (`bukan_pic` di `tasks_before_update`; perubahan dari SQL Editor tidak dibatasi).
   - **On Progress:** sedang dikerjakan; waktu kerja berjalan.
   - **Delay:** ditunda **manual** karena menunggu sesuatu (mis. bahan dari requester). Waktu kerja berhenti selama di Delay.
   - **Finish:** **link hasil opsional** (sejak 2 Nov 2026). Waktu kerja berhenti.
   - **Terlambat** (lewat deadline) bukan kolom: badge merah di kolom mana pun kecuali Finish.
   - **Urutan kartu:** deadline terdekat paling atas (Request, On Progress, Delay). Finish: yang terakhir selesai paling atas.
   - **10 kartu per halaman di setiap kolom** (4 Nov 2026, `PAGE_SIZE` di `BoardPage.js`). Kolom berisi > 10 kartu: tombol ‹ › di bawah kartu ke-10 + "1–10 dari 23 · Halaman 1 dari 3". Angka di kepala kolom tetap total. Halaman tiap kolom berdiri sendiri; kembali ke halaman 1 saat cari/filter berubah; banner "Lihat" membuka Request halaman 1. Setelah memindah kartu (geser, "Pindah ke…", "Mulai kerjakan"), kolom tujuan otomatis membuka halaman tempat kartu itu berada. Desktop: tiap kolom setinggi layar dan bisa di-scroll sendiri.
4. **Pindah kolom maju dan mundur** lewat **geser kartu** (desktop) dan tombol **"Pindah ke…"** (desktop dan HP):
   - Dari Request ke kolom lain: hanya PIC atau admin (lihat di atas).
   - Ke Finish: dialog link hasil (opsional).
   - Finish → On Progress/Delay = **revisi**; waktu kerja melanjutkan total sebelumnya.
   - Ke Request: **PIC tetap**; waktu yang sudah tercatat tetap disimpan.
5. **Kerja bersama:** satu task bisa dikerjakan Denny dan Arum. PIC tetap satu (penanggung jawab: pindah kolom, isi link hasil). Tim membagi **checklist** di detail task; tiap item punya pengerja (`assignee`). Tidak ada link per item checklist; link referensi per task.
6. **Waktu (time tracking), diubah 2 Nov 2026:**
   - Dimulai saat **request masuk** dan berhenti saat **Finish**. Dicatat **per kolom**: berapa lama di Request (menunggu diambil), di On Progress (dikerjakan), dan di Delay, plus **total**.
   - Hanya **jam kerja Senin–Jumat 08.00–17.00 WIB** yang dihitung.
   - Revisi (Finish → kolom lain) membuka waktu lagi dan menambah ke total. Kembali ke Request menambah waktu Request.
   - Format tampilan (`fmtDuration`): 1 hari = 9 jam kerja. "5 menit", "4 jam 25 menit", "1 hari" (tepat 9 jam), "1 hari 3 jam 25 menit" (lengkap, bagian 0 tidak ditulis). CSV tetap menit.
   - Kartu: total (berjalan, hijau bila belum Finish). Detail: rincian Di Request · Di On Progress · Di Delay · Total. Export CSV: keempat angka dalam menit.
   - Analitik "rata-rata pengerjaan" memakai waktu di On Progress. Task bersama: durasi dihitung untuk PIC **dan** setiap pengerja checklist.
   - Hari libur nasional belum diperhitungkan (bisa ditambah daftar libur nanti).
7. **Lampiran dihapus otomatis 30 hari setelah Finish** (diubah dari 7 hari, 10 Nov 2026; `ATTACHMENT_RETENTION_DAYS` di `config.js` = `RETENTION_DAYS` di Edge Function). Foto, thumbnail, dan PDF. Juga 30 hari setelah task diarsipkan, dan file yatim (folder Storage tanpa task) > 1 hari. Baris task, link referensi, link hasil, checklist, waktu kerja tetap ada; riwayat `lampiran_dihapus` oleh "sistem".
   - Sebelum dihapus: kartu dan detail menampilkan "Lampiran akan dihapus otomatis 10 Desember 2026" (`attachmentsDeleteDate` di `taskModel.js`). Sesudah: "Lampiran dihapus otomatis".
   - Kalau task direvisi sebelum 30 hari, hitungan dimulai lagi dari Finish berikutnya. Lampiran baru yang ditambahkan setelah penghapusan mengosongkan lagi `attachments_deleted_at` (trigger).
   - Mekanisme: Supabase Edge Function `supabase/functions/hapus-lampiran/index.ts` (hapus file lewat Storage API, lalu update task dengan service role) dijalankan Supabase Cron setiap hari 18.00 UTC (01.00 WIB). Dipasang manual lewat dashboard: `docs/PANDUAN-SUPABASE.md` bagian 7.
8. **Detail task = pop-up mengambang** di tengah layar (HP: layar penuh), dibuka dengan klik kartu.
   - Kanan atas: ikon **hijau Edit**, **merah Hapus** (dengan konfirmasi), **abu-abu Tutup**.
   - Isi: info request, lampiran, link referensi, checklist per orang, link hasil, waktu kerja, riwayat task, aksi pindah kolom.
   - Pratinjau foto (lightbox) bisa digeser antar foto: tombol kiri/kanan, panah keyboard, geser jari di HP, thumbnail di bawah, penghitung "2 / 4". Escape menutup pratinjau saja, pop-up detail tetap terbuka.
   - Hanya tim desain/admin yang bisa mengedit isi request.
9. **Hapus = arsip** (soft delete). Task hilang dari board, tetap ada di database beserta riwayatnya; admin bisa memulihkan.
10. **Audit / riwayat perubahan:** semua perubahan dicatat otomatis oleh database beserta **akun Google pelakunya**: dibuat, edit field, pindah kolom, ganti PIC, checklist, lampiran, link hasil, hapus/pulihkan, dan penghapusan lampiran otomatis (pelaku "sistem"). Riwayat tidak bisa diubah atau dihapus siapa pun. Tampil di detail task; halaman audit lengkap untuk admin.
11. **Pencarian** di bagian paling atas board (search bar di header hijau): judul, brief, nama requester, dan divisi; tidak peka huruf besar/kecil, cocok sebagian. Saat mencari (≥2 huruf) board juga mencari ke database (`searchTasks`) sehingga task Finish lama yang tidak dimuat tetap ketemu (label "Dari arsip lama"); hasil Finish saat mencari tidak dibatasi 30 hari.
12. **Analitik per orang:** task selesai, persen tepat waktu, rata-rata waktu kerja per task (On Progress), rata-rata menunggu dikerjakan (Request sampai On Progress), jumlah masuk Delay. Bisa dibandingkan dengan **minggu lalu** atau **bulan lalu** (naik/turun ditampilkan, hijau = membaik, merah = memburuk).
    - Periode: **Minggu ini** · **Bulan ini** saja (`lib/periods.js`, diubah 2 Nov 2026). Selalu periode penuh vs periode penuh tepat sebelumnya: Minggu ini 2–8 Nov vs 26 Okt – 1 Nov; Bulan ini 1–30 Nov vs 1–31 Okt. Minggu = Senin–Minggu, bulan = kalender. Karena periode ini masih berjalan, tampil keterangan "periode masih berjalan, hari ke-n dari 7/30".
    - Urutan halaman (5 Nov 2026): periode → ringkasan tim → **"Kinerja tiap desainer"** (kartu per orang) → **"Perbandingan antar desainer"** → per kategori/divisi.
    - Kartu per orang: grafik batang task selesai per hari (minggu) atau per minggu (bulan), periode ini vs pembanding, dengan sumbu angka, angka di atas batang, dan ikon (i) penjelasan di tiap angka.
    - Perbandingan antar desainer: (1) grafik garis task selesai per hari, satu garis per desainer (garis ke-2 putus-putus), 7 titik / 28–31 titik, hari yang belum lewat tidak digambar; (2) ketepatan waktu, batang horizontal 0–100%; (3) rata-rata waktu per task, batang horizontal bertumpuk Menunggu dikerjakan + Pengerjaan + Ditunda (jam kerja).
    - **Semua rata-rata waktu (pengerjaan, menunggu dikerjakan, ditunda) dihitung dari task yang selesai di periode itu**, jadi bagian batang bertumpuk bisa dijumlah.
    - **Tooltip** di semua grafik dan ikon (i): hover/fokus keyboard (desktop), ketuk (HP). Isi tooltip batang: tanggal, periode ini vs pembanding, selisih, judul task (maks 5 + "N lainnya").
13. **Halaman Anggota (admin):** tambah Gmail + nama + peran + warna; ubah peran/warna; nonaktifkan (langsung tidak bisa masuk); hapus hanya untuk anggota nonaktif. Akun sendiri tidak bisa diturunkan/dinonaktifkan dari UI, dan database menolak bila tidak tersisa admin aktif (`team_members_admin_guard`, pesan `admin_terakhir`). Nama tidak bisa diubah (dipakai sebagai PIC).
14. **Edit lampiran oleh tim:** di pop-up detail ("Tambah lampiran", ikon hapus per file dengan konfirmasi). Batas tetap 5 file; file dihapus juga dari Storage; tercatat di riwayat.

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
- Login: **Supabase Auth (Google)**. Mode uji coba: akun tiruan (`LOCAL_MEMBERS` di `config.js`).
- Geser kartu: **HTML5 drag and drop bawaan** (tanpa pustaka), hanya desktop dengan mouse. HP, layar sentuh, dan keyboard memakai tombol "Pindah ke…".
- Hapus lampiran otomatis: Supabase Edge Function `hapus-lampiran` (Deno) + Supabase Cron harian. File Storage dihapus lewat Storage API, bukan `delete from storage.objects`. Kode function ada di repo tetapi di-deploy manual lewat dashboard (tidak ada CI Supabase).
- `api/request.js`: Vercel Serverless Function lama untuk Google Apps Script. Tidak dipakai frontend dan tidak menyimpan data.

## Perintah

```bash
npm install
npm start        # dev server CRA (http://localhost:3000)
npm run build    # build produksi ke /build (CI=true: warning ESLint dianggap error)
```

Environment variable (atur di Vercel → Settings → Environment Variables):

- `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_PUBLISHABLE_KEY` (atau `REACT_APP_SUPABASE_ANON_KEY`): koneksi Supabase. Keduanya aman di browser. Jangan pernah memakai secret/service_role key di frontend.
- Login Google: Client ID/Secret diatur di Supabase → Authentication → Sign In / Providers → Google (bukan di Vercel). Bila Google Cloud dalam mode **Testing**, setiap Gmail anggota juga harus ada di **Test users** (kecuali pemilik proyek Google Cloud); bila **In production**, tidak perlu. Tombol Publish butuh homepage + privacy policy URL.
- Anggota tim: `supabase/anggota-awal.sql` (sekali), lalu tabel `team_members`.

Langkah menyiapkan Supabase untuk pemilik proyek: `docs/PANDUAN-SUPABASE.md`.

Belum ada test otomatis di repo. Uji manual minimal v8: kirim request dengan 2 foto + 1 PDF + link; banner dan badge "Baru" muncul di board; Ambil lewat tombol Arum/Denny; checklist dibagi dua orang; geser ke Delay (waktu berhenti) lalu kembali; Finish (wajib link); revisi dari Finish; cek riwayat dan audit; cek tampilan HP (lebar 390px). Tahap 2: tambah/nonaktifkan/hapus anggota; hapus task lalu pulihkan di Audit; tambah/hapus lampiran dari detail; analitik Minggu ini vs minggu lalu. 2 Nov 2026: tentukan PIC (tetap di Request), akun lain tidak bisa memulai, PIC memulai; Finish tanpa link; cari brief/requester/divisi.

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
  resultLinks: [{ id, url }],            // opsional (dulu wajib saat finish)
  checklist: [{ id, text, done, assignee, doneAt, position }],   // tabel task_checklist
  workSessions: [{ status: "request" | "on_progress" | "delay", startedAt, endedAt }],  // sesi waktu per kolom (lib/worktime.js: stageMinutes)
  createdAt, startedAt, finishedAt, attachmentsDeletedAt, deletedAt, updatedAt,
}
```

Tabel Supabase v8:

- `tasks`: kolom di atas (snake_case). Constraint: `tasks_pic_wajib` (`tasks_link_hasil_wajib` dihapus 2 Nov 2026). `deleted_at`/`deleted_by` untuk arsip.
- `task_checklist`: 1 baris per item (sudah ada di v7).
- `work_sessions`: `task_id`, `status` (kolom: request/on_progress/delay), `started_at`, `ended_at` (null = sedang berjalan). Request baru membuka sesi `request`; setiap pindah kolom menutup sesi lama dan membuka sesi kolom baru; Finish hanya menutup. Menit dihitung hanya jam kerja Senin–Jumat 08.00–17.00 WIB (`work_minutes()` di SQL = `workMinutesBetween()` di JS). `schema.sql` melengkapi data lama sekali (waktu Request = `created_at` sampai `started_at`).
- `task_history`: audit, ditulis trigger database. `actor_email`, `actor_name` (requester: nama dari form; otomatis: "sistem"), `action`, `changes [{field, before, after}]`. Tidak ada izin UPDATE/DELETE untuk siapa pun.
- `task_reads`: `task_id`, `member_email`, `read_at` (badge "Baru" per akun).
- `team_members`: `email` (Gmail), `name`, `role: "designer" | "admin"`, `active`, `color`. Constraint trigger `team_members_admin_guard` (deferred): minimal satu admin aktif harus tersisa.
- Storage bucket `references`: `<id task>/<file>` untuk foto, thumbnail, dan PDF (maks 5 MB, JPG/PNG/WEBP/PDF).

Tidak ada migrasi v7 → v8: skema v7 tidak pernah dijalankan di database produksi (proyek Supabase dibuat baru untuk v8). `schema.sql` v8 ditulis untuk database baru dan aman dijalankan ulang.

Trigger database (sumber kebenaran; mode uji coba menirunya di `applyTransition` + `localStore.js`):
- `tasks_before_update`: task terarsip hanya bisa diubah admin atau sistem (tanpa email: Edge Function/SQL Editor); lampiran baru → `attachments_deleted_at` dikosongkan; keluar dari Request hanya oleh PIC/admin (`bukan_pic`); masuk On Progress pertama kali → `started_at`; masuk Finish → `finished_at`, keluar dari Finish → dikosongkan; selain Delay → `delay_reason` dikosongkan; arsip → `deleted_by`; task terarsip hanya bisa diubah admin.
- `tasks_after_write`: buka/tutup `work_sessions` per kolom, tulis `task_history` (`dibuat` oleh requester, `pic_ditentukan`/`pic_dilepas` (ganti PIC di Request), `diambil` (= mulai dikerjakan), `ditunda`, `dilanjutkan`, `selesai`, `revisi`, `dilepas`, `dipindah`, `diubah`, `dihapus`, `dipulihkan`, `lampiran_dihapus`).
- `checklist_after_write`: riwayat `checklist` (lewati bila task-nya dihapus permanen).

## Aturan tata letak UI (v8, acuan: mockup)

1. **Header hijau** (gradasi hijau Infarm): logo + judul kiri.
   - Tim: **search bar judul** di tengah; kanan: Salin & buka form (menyalin link form sekaligus membukanya di tab baru) · Export CSV · avatar akun (menu: nama, email, Keluar). HP: ikon cari + avatar; Salin link form dan Export CSV pindah ke menu akun.
   - Form request: hanya logo + judul, tanpa tombol.
2. **Banner request baru** tepat di bawah header (hanya bila ada yang belum dilihat akun ini).
3. **Urutan halaman tim:**
   - Kanban: tab Kanban · Analitik (admin: + Audit · Anggota) → 5 chip angka (Request, On Progress, Delay, Terlambat, Selesai 30 hari) → filter (Tugas saya/Semua, PIC, deadline) → 4 kolom Kanban (HP: satu kolom, dipilih lewat tombol kolom).
   - HP: tab diganti **menu bawah** (Kanban · Analitik · Akun; admin: Kanban · Analitik · Admin).
   - Analitik: tab → periode → ringkasan tim → Kinerja tiap desainer → Perbandingan antar desainer → per kategori/divisi.
   - Di HP, chip angka jadi satu baris yang bisa digeser.
4. **Anatomi kartu:** badge (Baru / Terlambat) + deadline di kanan → judul → kategori · requester (divisi) → lampiran mini (maks 3 thumbnail + "+2", PDF sebagai ikon) → PIC + "bersama …" → waktu kerja → progres checklist → aksi (Request tanpa PIC: "Tentukan PIC" + tombol Arum/Denny; Request ber-PIC: "Mulai kerjakan" (PIC/admin) + "Ganti PIC ke …"; lainnya: "Pindah ke…").
5. **Detail pop-up:** maks 760px di tengah dengan latar redup (HP: layar penuh). Kanan atas: Edit (hijau), Hapus (merah), Tutup (abu-abu). Aksi pindah kolom di bawah.
6. **Desktop dan HP memakai komponen yang sama**; HP hanya beda ukuran sentuh (44px) dan susunan menumpuk. Dialog di HP muncul dari bawah dengan tombol utama di atas.
7. **Lebar konten:** halaman tim 1400px, form request 1040px (halaman terkirim 760px).
8. **Skala:** teks 13px, judul 15–18px, angka 20px; tombol 36px (HP 44px), CTA 42px (HP 48px), input 38px (HP 44px).
9. **Halaman kolom:** tombol ‹ › 36px (HP 44px), › hijau, nonaktif abu-abu; keterangan di tengah.
10. **Warna:** hijau Infarm untuk aksi utama dan status aktif; soil/cream untuk Arum dan label kategori; merah hanya untuk Terlambat/Hapus. Kolom: Request abu-abu · On Progress soil · Delay amber · Finish hijau. Lampiran di kartu: foto cream, PDF merah muda. Status selalu ada label teks, bukan hanya warna.

## Pola dan konvensi kode

- Komponen tidak pernah memanggil Supabase/localStorage langsung: baca lewat `useTasks()`, ubah lewat fungsi di `taskActions.js`.
- Kolom baru di task: tambah di `schema.sql` (tabel + `alter table ... add column if not exists`), `taskModel.js` (`normalizeTask`, `COLUMNS`), lalu UI. Audit ditulis oleh trigger, jadi kolom baru otomatis tercatat bila didaftarkan di fungsi pembanding riwayat.
- `Modal` bertumpuk (mis. konfirmasi di atas detail): Escape hanya menutup modal paling atas.
- Aksi dijalankan lewat `useAction(showToast)` → `run(() => aksi(...), "pesan sukses")`. Error otomatis jadi toast, dan data di layar tidak berubah.
- `taskStore` memperbarui cache hanya SETELAH penulisan berhasil.
- Desainer baru (v8): ditambah admin di halaman Anggota (tabel `team_members`), bukan di kode.
- Teks UI Bahasa Indonesia, sentence case, tanpa emoji (aturan design system Infarm). Status selalu ada label teks, bukan hanya warna.
- Link diketik tanpa `https://` tetap diterima: pakai `normalizeUrl`, dan input link memakai `type="text" inputMode="url"`.
- Waktu kerja: satu fungsi perhitungan jam kerja di SQL dan padanannya di JS (untuk angka berjalan di layar) harus selalu sama.

## Tahapan v8

- **Tahap 1 (sudah):** skema v8 + RLS + trigger, login Google + `team_members`, form `/` foto + PDF maks 5 + thumbnail, board 4 kolom (urut deadline), geser kartu + "Pindah ke…", tombol Arum/Denny di kartu Request, pop-up detail (Edit/Hapus/Tutup), checklist per orang, waktu kerja jam kerja, riwayat di detail, hapus = arsip, pencarian judul, filter Tugas saya/PIC/deadline, menu bawah HP.
- **Tahap 2 (sudah):** analitik per orang + pembanding minggu/bulan lalu, halaman Audit (admin, termasuk pulihkan task terhapus), halaman Anggota (admin), edit lampiran oleh tim.
- **Sudah ditarik dari tahap 3:** banner + kartu "Baru" per akun (`task_reads`).
- **Tahap 3:** penghapusan lampiran otomatis 30 hari setelah Finish (kode sudah, 10 Nov 2026; perlu dipasang di dashboard Supabase), (opsional, belum) halaman `/privasi` untuk Publish di Google.

## Dari v7 ke v8 (ringkasan perubahan)

| Bagian | v7 (sebelumnya) | v8 |
|---|---|---|
| Akses tim | PIN bersama (`team_*` RPC + `app_settings`) | Login Google + `team_members`, RLS `authenticated` |
| Requester | Halaman status publik `/` + edit `/request/:id/edit` | Hanya form `/`; tidak bisa melihat/mengedit |
| Kolom | Request, Todo, On Progress, Finish | Request, On Progress, Delay, Finish |
| Pindah kolom | Tombol per tahap | Geser kartu + "Pindah ke…" (maju/mundur) |
| Lampiran | Gambar saja, maks 6, hapus manual saat Finish | Gambar + PDF, maks 5, thumbnail, hapus otomatis 30 hari setelah Finish |
| Detail | Panel kanan 480px | Pop-up tengah + ikon Edit/Hapus/Tutup |
| Riwayat | actor "requester"/"tim" | Akun Google pelaku, semua perubahan, tidak bisa diubah; halaman audit admin |
| Hapus task | Permanen | Arsip, bisa dipulihkan admin |
| Notifikasi | Tidak ada | Banner + kartu "Baru" per akun |
| Waktu kerja | Tidak ada | Jam kerja Senin–Jumat 08–17, berhenti di Delay |
| Analitik | Per desainer, periode | + per orang dibanding minggu/bulan lalu, rata-rata waktu kerja |

File v7 yang sudah dihapus: `src/pages/StatusPage.js`, `src/pages/EditRequestPage.js`, `src/lib/pin.js`, `supabase/set-pin.sql`, `team/FinishDialog.js` (digabung ke `MoveDialog.js`).

## Struktur file

```
public/index.html          title, viewport, font Google (Geist, Montserrat)
public/logo-infarm.png     logo + favicon
vercel.json                rewrite semua path (kecuali /api) ke index.html
src/index.js               entry: BrowserRouter + styles.css
src/App.js                 routing: "/" form, "/request" → "/", "/tim/*" (+ redirect link lama "/#/request")
src/config.js              CATEGORIES, DIVISIONS, STATUS(ES), batas lampiran, koneksi Supabase, LOCAL_MEMBERS (mode uji coba)
src/styles.css             semua style (token Infarm, komponen, responsive)
supabase/schema.sql        skema v8: tabel, RLS, trigger (riwayat, sesi kerja, aturan kolom), work_minutes(), Storage, Realtime
supabase/anggota-awal.sql  anggota awal (Gmail Denny, Arum, SPV) — diisi pemilik proyek, dijalankan sekali
supabase/functions/hapus-lampiran/index.ts  Edge Function harian: hapus lampiran 30 hari setelah Finish/arsip + file yatim
supabase/reset-anggota.sql ganti SEMUA anggota (mis. akun uji coba → akun asli); opsional kosongkan task uji coba
docs/PANDUAN-SUPABASE.md   panduan non-teknis menyiapkan Supabase + Google + Vercel
src/data/
  supabaseClient.js        satu klien Supabase (sesi login disimpan & diperbarui otomatis)
  auth.js                  login Google / akun tiruan, cek anggota (my_membership), useAuth(), refreshAuth()
  members.js               kelola team_members (list/add/update/remove; mode uji coba: localStorage infarm_members_v8)
  taskStore.js             pintu masuk data: memilih supabaseStore atau localStore sesuai STORAGE_MODE
  supabaseStore.js         Supabase: insert request (anon), baca/ubah (anggota), lampiran Storage, checklist, riwayat, Realtime
  localStore.js            localStorage (mode uji coba): meniru aturan trigger, sesi kerja, riwayat
  taskModel.js             normalizeTask, fromRow/toRow, applyTransition, taskChanges/historyAction (padanan SQL), helpers, involves
  taskActions.js           aksi alur kerja (submitRequest, takeTask, moveTask, changePic, editTask, deleteTask, checklist, ...)
  useTasks.js              hook React: daftar task yang ikut berubah otomatis
  useReads.js              hook React: penanda "sudah dilihat" per akun → isNew(task), markRead(id)
src/lib/
  worktime.js              jam kerja Sen–Jum 08–17 WIB (padanan work_minutes() di SQL), stageMinutes (per kolom + total), fmtDuration
  dates.js                 tanggal, overdue, tepat waktu
  periods.js               periode analitik + pembanding (minggu/bulan lalu), kelompok grafik
  images.js                lampiran: kompres foto + thumbnail, cek PDF ≤5 MB, fmtBytes, newId
  links.js                 normalizeUrl, displayUrl
  csv.js                   export CSV (RFC 4180 + BOM untuk Excel)
  changes.js               teks riwayat (aksi + perubahan field)
src/components/
  ui.js                    AppHeader, LocalModeBanner, StatusBadge, Avatar, Modal, Pager (tombol halaman ‹ ›), Lightbox (galeri, bisa digeser), AttachmentStrip/List, LinkList, useToast, useAction, useNow
  ReferenceEditor.js       input lampiran (foto + PDF, maks 5) + link referensi di form
src/pages/
  RequestPage.js           "/" form request + "Request sudah masuk"
  team/TeamLayout.js       "/tim/*" login Google, header (cari, salin & buka form, export, akun), banner request baru, tab / menu bawah HP
  team/BoardPage.js        Kanban 4 kolom, chip angka, filter, geser kartu
  team/TaskCard.js         kartu Kanban
  team/MoveDialog.js       "Pindah ke…": PIC (dari Request), alasan Delay, link hasil Finish
  team/TaskDetail.js       pop-up detail: edit, hapus (arsip), checklist per orang, link hasil, riwayat
  team/AnalyticsPage.js    "/tim/analitik": ringkasan tim + kartu per orang dengan selisih periode sebelumnya + grafik
  team/AuditPage.js        "/tim/audit" (admin): semua perubahan (filter judul/pelaku/aksi/rentang, tanda perubahan mencurigakan) + task terhapus (Pulihkan)
  team/MembersPage.js      "/tim/anggota" (admin): kelola anggota
```

## Masalah yang diketahui

- **Mode uji coba** (tanpa env Supabase): data hanya di browser; banner "Mode uji coba" tampil; login memakai akun tiruan (tanpa keamanan). PDF > 1 MB tidak disimpan isinya.
- **Board memuat semua task yang belum Finish + 500 task Finish yang paling baru selesai** (`FINISHED_LIMIT` di `supabaseStore.js`). Task Finish yang lebih lama tidak dihapus: tetap di database, bisa ditemukan lewat pencarian dan dibuka lewat link `/tim/task/:id`. Analitik dan Export CSV hanya memakai task yang dimuat.
- **Realtime mengambil ulang seluruh daftar** setiap ada perubahan (jeda 300 ms). Cukup untuk volume tim.
- **File yatim** bisa tersisa jika upload berhasil tapi simpan task gagal; dibersihkan oleh `hapus-lampiran` setelah > 1 hari (maks 1000 folder per jalan).
- **Supabase Free dijeda** setelah 7 hari tanpa aktivitas; Cron `hapus-lampiran-harian` ikut berhenti selama dijeda, lalu mengejar di jadwal berikutnya.
- **Mode uji coba** (localStorage) tidak menjalankan penghapusan otomatis; hanya keterangan tanggalnya yang tampil.
- **Bucket `references` publik**: file bisa dibuka siapa pun yang tahu URL-nya (nama file UUID, tidak bisa ditebak; tidak bisa di-list oleh requester).
- **Upload lampiran oleh requester** belum diuji di Supabase sungguhan (hanya di tiruan); cek pertama kali di preview.
- **Libur nasional** belum dikecualikan dari waktu kerja.
- **Kode lebih baru dari database:** bila `schema.sql` terbaru belum dijalankan (mis. kolom `work_sessions.status` dari 2 Nov 2026), daftar task gagal dimuat. Board menampilkan banner merah "Daftar task gagal dimuat… jalankan ulang supabase/schema.sql" + Coba lagi (bukan board kosong). Setiap PR yang mengubah `schema.sql`: jalankan ulang di Supabase sebelum merge.
- **Halaman Audit memuat 500 perubahan terbaru** (filter berjalan di browser) dan menampilkannya **30 baris per halaman** dengan tombol ‹ › (6 Nov 2026; tab Task terhapus juga 30 per halaman; kembali ke halaman 1 saat filter berubah). Tambahkan pengambilan per halaman dari server bila riwayat sudah sangat banyak.
- **Menghapus anggota tidak mengubah task-nya:** `tasks.pic` dan `assignee` checklist menyimpan nama, jadi task milik anggota yang dihapus tetap ada dengan nama lama (avatar abu-abu). Ganti PIC lewat detail task. Lebih aman menonaktifkan daripada menghapus.
- **Data uji coba sebelum 2 Nov 2026**: waktu di Delay dari sebelum perubahan ini tidak tercatat (dulu hanya On Progress yang dicatat).
- **Pop-up di HP** memakai tinggi layar yang terlihat (100% dari `.modal-wrap` / `dvh`), bukan `100vh`: di browser HP `100vh` lebih tinggi dari layar sehingga tombol Tutup terdorong ke balik bilah alamat.

## Integrasi Supabase

- Requester (`anon`): hanya `INSERT` request bersih (tanpa membaca balik; konfirmasi memakai isian form) dan upload ke Storage `references`.
- Anggota aktif (`authenticated`, email ∈ `team_members`): `SELECT/UPDATE` task, kelola `task_checklist`, baca `work_sessions`, `task_history`, `team_members`, baca/tambah `task_reads` miliknya sendiri. Tidak ada `DELETE` task (hapus = `deleted_at`).
- Admin: + kelola `team_members`, ubah/pulihkan task terarsip.
- `task_history` dan `work_sessions` hanya ditulis trigger (`security definer`); tidak ada izin tulis untuk siapa pun.
- Setelah update, aplikasi membaca ulang task (sesi kerja dibuat trigger setelah update, tidak ikut terbaca di permintaan yang sama).
- Uji lokal: Postgres 16 + stub role `anon`/`authenticated`, `auth.jwt()` dari `request.jwt.claims`, schema `storage`, publication `supabase_realtime`. Uji end-to-end memakai server tiruan PostgREST yang meneruskan permintaan ke Postgres tersebut dengan peran dari token (lihat riwayat sesi; skripnya tidak disimpan di repo).
