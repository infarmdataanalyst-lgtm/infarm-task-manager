# CLAUDE.md

Panduan untuk Claude (dan developer) saat bekerja di repo ini.

## Ringkasan proyek

**Infarm Design Task Manager**: aplikasi web internal untuk mengelola request desain grafis di INFARM.ID.
Divisi lain (Sales, Bidev, HRD, Marketing, Management) mengirim request lewat form publik.
Tim Desain (Denny & Arum) memproses task di papan Kanban sampai selesai.

- Live: https://infarm-task-manager.vercel.app/ (status request), `/request` (form), `/tim` (board tim desain)
- Hosting: Vercel (auto-deploy dari GitHub)
- Bahasa UI dan komentar kode: Bahasa Indonesia

## Alur kerja (disepakati dengan pemilik proyek, Oktober 2026)

1. **Request:** orang non-desain mengisi form `/request`, termasuk gambar referensi (upload) dan/atau link referensi. Task masuk ke kolom **Request** tanpa PIC.
2. **Assign:** Denny/Arum membagi task sendiri (tidak ada koordinator). Memilih PIC sekaligus memindah task ke **Todo**. Task tidak boleh masuk Todo tanpa PIC.
3. **Todo:** kartu menampilkan nama PIC dengan jelas.
4. **On Progress:** PIC memindahkan task-nya sendiri. **Tidak ada login**; aturan "hanya PIC" berbasis kepercayaan, tidak ditegakkan sistem.
5. **Finish:** PIC memindahkan ke Finish **wajib menyertakan minimal satu link hasil**. Setelah Finish, gambar referensi boleh dihapus.
6. **Revisi:** task Finish boleh dikembalikan ke On Progress.
7. **Cek status (requester):** satu halaman publik tanpa login yang menampilkan **semua** request (tidak ada link unik per request; requester boleh melihat request orang lain). Requester bisa memastikan request-nya sudah masuk, bahwa gambar/link referensinya muncul dengan benar, serta melihat status, PIC, dan link hasil setelah Finish. Mockup UI/UX: https://claude.ai/artifact/X2yJtpb2ETevn9AR56V5nu

8. **Tampilan board:** hanya tab **Kanban** dan **Analitik**. Tab List/Daftar dihapus karena sudah tercakup di halaman status. Semua halaman harus nyaman di desktop dan HP.

9. **Struktur link (target):**

   | Path | Untuk | Isi |
   |---|---|---|
   | `/` | requester | Status semua request (halaman utama) + tombol "Buat request baru" |
   | `/request` | requester | Form request, lalu halaman "Request sudah masuk" |
   | `/tim` | tim desain | Board Kanban (dilindungi PIN) |
   | `/tim/analitik` | tim desain | Analitik (dilindungi PIN) |
   | `/tim/task/:id` | tim desain | Detail task (deep link) |

   - Pakai React Router (path asli, bukan hash) + rewrite di `vercel.json`.
   - Link lama `/#/request` harus di-redirect ke `/request`.
   - Opsional: domain sendiri, mis. `desain.infarm.id`.
10. **PIN tim (bukan login):** `/tim/*` meminta satu PIN bersama (6 angka), lalu diingat di browser.
    - PIN harus ditegakkan di server, bukan hanya di UI, karena anon key Supabase bisa dipakai langsung. Peran `anon` hanya boleh `SELECT` task dan `INSERT` request baru.
    - Semua perubahan dari board (assign, pindah status, edit, hapus, checklist, link hasil) lewat fungsi RPC Postgres (`security definer`) yang memverifikasi hash PIN.

Alur di atas sudah diterapkan di kode. Database bersama memakai Supabase (aktif kalau environment variable Supabase diatur; lihat docs/PANDUAN-SUPABASE.md).

## Tech stack

- React 18 (function component + Hooks), JavaScript/JSX, tanpa TypeScript
- Create React App (`react-scripts` 5.0.1)
- React Router 6 (path asli; rewrite SPA di `vercel.json`)
- Ikon: `lucide-react` (sesuai design system Infarm)
- Styling: `src/styles.css` dengan CSS variables dari design system Infarm (brand-primary `#00843b`, brand-surface `#f5ffef`, Montserrat untuk heading, Geist untuk teks). Breakpoint HP: 720px.
- Penyimpanan: **Supabase** (`@supabase/supabase-js`: tabel `tasks`, Storage bucket `references`, Realtime) bila `REACT_APP_SUPABASE_URL` + key diatur; kalau tidak, **mode uji coba** `localStorage` (key `infarm_tasks_v6`). Pemilihan otomatis di `src/data/taskStore.js`.
- `api/request.js`: Vercel Serverless Function lama untuk Google Apps Script. Tidak dipakai frontend dan tidak menyimpan data.

## Perintah

```bash
npm install
npm start        # dev server CRA (http://localhost:3000)
npm run build    # build produksi ke /build (CI=true: warning ESLint dianggap error)
```

Environment variable (atur di Vercel → Settings → Environment Variables):

- `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_PUBLISHABLE_KEY` (atau `REACT_APP_SUPABASE_ANON_KEY`): koneksi Supabase. Keduanya aman di browser. Jangan pernah memakai secret/service_role key di frontend.
- PIN tim (mode Supabase): diatur di database lewat `supabase/set-pin.sql`, dicek di server.
- `REACT_APP_TEAM_PIN_SHA256`: hanya untuk mode uji coba (hash SHA-256 PIN, `printf 123456 | sha256sum`).

Langkah lengkap menyiapkan Supabase untuk pemilik proyek: `docs/PANDUAN-SUPABASE.md`.

Belum ada test otomatis. Uji manual minimal: kirim request bergambar + link, Ambil, Mulai, Finish (wajib link), Revisi, cek halaman status, cek tampilan HP (lebar 390px).

## Struktur file

```
public/index.html          title, viewport, font Google (Geist, Montserrat)
public/logo-infarm.png     logo + favicon
vercel.json                rewrite semua path (kecuali /api) ke index.html
src/index.js               entry: BrowserRouter + styles.css
src/App.js                 routing + redirect link lama "/#/request"
src/config.js              DESIGNERS (nama + warna), CATEGORIES, DIVISIONS, STATUS, PIN hash, STORAGE_MODE
src/styles.css             semua style (token Infarm, komponen, responsive)
supabase/schema.sql        skema database, aturan akses (RLS), fungsi RPC tim (cek PIN), bucket Storage, Realtime. Idempotent.
supabase/set-pin.sql       atur/ganti PIN tim (disimpan sebagai hash)
docs/PANDUAN-SUPABASE.md   panduan non-teknis menyiapkan Supabase + Vercel
src/data/
  taskStore.js             pintu masuk data: memilih supabaseStore atau localStore sesuai STORAGE_MODE
  supabaseStore.js         CRUD via Supabase (select/insert publik, update/delete lewat RPC ber-PIN), upload/hapus gambar, Realtime
  localStore.js            CRUD via localStorage (mode uji coba) + migrasi v5→v6 + sinkron antar tab
  taskModel.js             normalizeTask, pemetaan field camelCase ↔ kolom snake_case (fromRow/toRow)
  taskActions.js           aksi alur kerja (submitRequest, assignTask, startTask, finishTask, reviseTask, checklist, ...)
  useTasks.js              hook React: daftar task yang ikut berubah otomatis
src/lib/
  dates.js                 tanggal, overdue, deadline dekat, tepat waktu, rentang periode analitik
  images.js                kompres gambar (maks 1600px, JPEG 0.8), fmtBytes, newId
  links.js                 normalizeUrl (tambah https:// otomatis), displayUrl
  csv.js                   export CSV (escape RFC 4180 + BOM untuk Excel)
  pin.js                   PIN tim: cek ke server (mode Supabase) atau hash lokal; simpan PIN di browser untuk dikirim ke RPC
src/components/
  ui.js                    AppHeader, LocalModeBanner, StatusBadge, Avatar, Stepper, Modal, Lightbox,
                           ReferenceList, useToast, useAction
  ReferenceEditor.js       input gambar + link referensi di form request
src/pages/
  StatusPage.js            "/"  status semua request (publik)
  RequestPage.js           "/request" form + konfirmasi "Request sudah masuk"
  team/TeamLayout.js       "/tim/*" layar PIN, header tim, tab Kanban/Analitik
  team/BoardPage.js        "/tim", "/tim/task/:id" Kanban, filter, statistik, beban kerja
  team/TaskCard.js         kartu Kanban + tombol sesuai tahap
  team/TaskDetail.js       panel detail (kanan di desktop, layar penuh di HP): edit, checklist, link hasil, hapus
  team/FinishDialog.js     dialog Finish: wajib link hasil, opsi hapus gambar referensi
  team/AnalyticsPage.js    "/tim/analitik" KPI per periode, per desainer, per kategori/divisi
```

## Model data Task (v6)

```js
{
  id: string,                       // UUID
  title, category, division, requesterName, description: string,
  dueDate: "YYYY-MM-DD",
  status: "request" | "todo" | "on_progress" | "finish",
  pic: "Denny" | "Arum" | null,     // wajib ada mulai status todo
  referenceImages: [{ id, name, size /* byte */, path, url }],  // Supabase Storage (mode lokal: dataUrl)
  referenceLinks: [{ id, url }],
  resultLinks: [{ id, url }],       // wajib ≥1 saat finish
  checklist: [{ id, text, done, assignee }],
  createdAt, assignedAt, startedAt, finishedAt, referenceImagesDeletedAt, updatedAt: ISO string | null,
}
```

Data lama (`infarm_tasks_v5`) dimigrasi otomatis sekali ke v6 oleh `taskStore.load()`. Task contoh lama dibuang, lampiran non-gambar lama dibuang (dulu hanya nama file), dan key v5 dibiarkan sebagai cadangan.

## Aturan tata letak UI (acuan: mockup)

Mockup final: https://claude.ai/artifact/X2yJtpb2ETevn9AR56V5nu (catatan hijau "Aturan tata letak" di canvas). UI di kode harus mengikuti mockup ini.

1. **Header:** logo + judul + subjudul satu baris di kiri; tombol aksi di kanan. Isi tombol SAMA di semua tab dan perangkat; di HP hanya ikon dengan urutan yang sama.
   - Tim (`/tim`, `/tim/analitik`): Halaman status · Salin link form request · Export CSV.
   - Status (`/`): Buat request baru. Form & terkirim (`/request`): Lihat status semua request.
2. **Header hijau hanya berisi tombol aksi.** Pencarian, tab, dan filter selalu di isi halaman, bukan di header.
3. **Urutan halaman tim:**
   - Kanban: tab Kanban/Analitik → 5 kartu angka → beban kerja per desainer → baris filter (cari, PIC, deadline) → kolom Kanban (HP: satu kolom, dipilih lewat tombol kolom).
   - Analitik: tab → periode → 5 kartu KPI → per desainer → per kategori/divisi.
   - Di HP, kartu angka/KPI jadi satu baris yang bisa digeser.
4. **Satu anatomi kartu** (board dan halaman status): badge status + badge urgensi, deadline di kanan → judul → kategori · requester → PIC + ringkasan referensi → progres → tombol aksi di bawah.
5. **Detail task:** tombol Tutup di kanan atas (desktop: panel kanan 480px, HP: layar penuh). Footer menempel di bawah: aksi utama lebar penuh, lalu Edit (kiri) dan Hapus task (kanan). Ganti PIC lewat tombol "Ganti" di kotak PIC.
6. **Desktop dan HP memakai komponen yang sama**; HP hanya beda ukuran sentuh (44px) dan susunan menumpuk. Dialog di HP muncul dari bawah dengan tombol utama di atas.
7. **Lebar konten:** halaman tim 1400px, halaman requester 1040px (halaman terkirim 760px).
8. **Skala:** teks 13px, judul 15–18px, angka 20px; tombol 36px (HP 44px), CTA 42px (HP 48px), input 38px (HP 44px).

## Pola dan konvensi kode

- Komponen tidak pernah memanggil Supabase/localStorage langsung: baca lewat `useTasks()`, ubah lewat fungsi di `taskActions.js`.
- Kolom baru di task: tambah di `schema.sql` (tabel + `team_update_task`), `taskModel.js` (`normalizeTask`, `COLUMNS`), lalu UI.
- Aksi dijalankan lewat `useAction(showToast)` → `run(() => aksi(...), "pesan sukses")`. Error (mis. penyimpanan penuh) otomatis jadi toast, dan data di layar tidak berubah.
- `taskStore` memperbarui cache hanya SETELAH penulisan berhasil.
- Desainer baru: tambah di `DESIGNERS` (`config.js`). Semua tombol Ambil, filter, checklist, dan analitik ikut otomatis.
- Teks UI Bahasa Indonesia, sentence case, tanpa emoji (aturan design system Infarm). Status selalu ada label teks, bukan hanya warna.
- Link diketik tanpa `https://` tetap diterima: pakai `normalizeUrl`, dan input link memakai `type="text" inputMode="url"` (bukan `type="url"`, karena validasi bawaan browser menolak link tanpa skema).

## Masalah yang diketahui

- **Mode uji coba** (tanpa env Supabase): data hanya di browser; banner "Mode uji coba" tampil; PIN hanya penghalang di UI.
- **Daftar task dibatasi 500 terbaru** (`LIST_LIMIT` di `supabaseStore.js`). Tambahkan paginasi bila task lebih banyak.
- **Realtime mengambil ulang seluruh daftar** setiap ada perubahan (diberi jeda 300 ms). Cukup untuk volume tim; optimalkan bila daftar membesar.
- **PIN 6 angka** bisa ditebak dengan banyak percobaan; server memberi jeda 1 detik per PIN salah. Ganti PIN bila curiga bocor.
- **File gambar yatim** bisa tersisa jika upload berhasil tapi simpan task gagal. Aman diabaikan atau dibersihkan manual di Storage.

## Integrasi Supabase (sudah di kode)

- Requester (`anon`): `SELECT` semua task, `INSERT` request baru bersih (status `request`, tanpa PIC/hasil/checklist), upload gambar ke `references/<id task>/<file>.jpg` (`cacheControl` 1 tahun).
- Tim: semua perubahan lewat `team_update_task(p_pin, p_id, p_patch)` dan `team_delete_task(p_pin, p_id)`; PIN dicocokkan dengan hash di `app_settings` (tidak bisa dibaca dari browser). PIN salah → error `invalid_pin` → aplikasi kembali ke layar PIN.
- Constraint database: `tasks_pic_wajib` (status selain request wajib PIC), `tasks_link_hasil_wajib` (finish wajib link hasil).
- Gambar referensi hanya bisa dihapus bila task sudah Finish atau sudah dihapus (policy Storage).
- Uji SQL lokal: Postgres 16 + stub role `anon`/`authenticated`, schema `storage`, publication `supabase_realtime`.
