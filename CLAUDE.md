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

Alur di atas sudah diterapkan di kode (Tahap 1), kecuali bagian yang butuh database: data masih per browser.

## Tech stack

- React 18 (function component + Hooks), JavaScript/JSX, tanpa TypeScript
- Create React App (`react-scripts` 5.0.1)
- React Router 6 (path asli; rewrite SPA di `vercel.json`)
- Ikon: `lucide-react` (sesuai design system Infarm)
- Styling: `src/styles.css` dengan CSS variables dari design system Infarm (brand-primary `#00843b`, brand-surface `#f5ffef`, Montserrat untuk heading, Geist untuk teks). Breakpoint HP: 720px.
- Penyimpanan: **sementara** `localStorage` (key `infarm_tasks_v6`) lewat `src/data/taskStore.js`. Rencana: Supabase.
- `api/request.js`: Vercel Serverless Function lama untuk Google Apps Script. Tidak dipakai frontend dan tidak menyimpan data.

## Perintah

```bash
npm install
npm start        # dev server CRA (http://localhost:3000)
npm run build    # build produksi ke /build (CI=true: warning ESLint dianggap error)
```

Environment variable (atur di Vercel → Settings → Environment Variables):

- `REACT_APP_TEAM_PIN_SHA256`: hash SHA-256 dari PIN tim 6 angka. Buat dengan `printf 123456 | sha256sum`. Kosong = `/tim` tidak dikunci (muncul peringatan di board).

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
src/data/
  taskStore.js             CRUD task (async) + migrasi v5→v6 + sinkron antar tab. SATU-SATUNYA file yang menyimpan data task (localStorage).
  taskActions.js           aksi alur kerja (submitRequest, assignTask, startTask, finishTask, reviseTask, checklist, ...)
  useTasks.js              hook React: daftar task yang ikut berubah otomatis
src/lib/
  dates.js                 tanggal, overdue, deadline dekat, tepat waktu, rentang periode analitik
  images.js                kompres gambar (maks 1600px, JPEG 0.8), fmtBytes, newId
  links.js                 normalizeUrl (tambah https:// otomatis), displayUrl
  csv.js                   export CSV (escape RFC 4180 + BOM untuk Excel)
  pin.js                   cek PIN (SHA-256), ingat di localStorage/sessionStorage
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
  referenceImages: [{ id, name, size /* byte */, dataUrl }],   // nanti: url Supabase Storage, bukan dataUrl
  referenceLinks: [{ id, url }],
  resultLinks: [{ id, url }],       // wajib ≥1 saat finish
  checklist: [{ id, text, done, assignee }],
  createdAt, assignedAt, startedAt, finishedAt, referenceImagesDeletedAt, updatedAt: ISO string | null,
}
```

Data lama (`infarm_tasks_v5`) dimigrasi otomatis sekali ke v6 oleh `taskStore.load()`. Task contoh lama dibuang, lampiran non-gambar lama dibuang (dulu hanya nama file), dan key v5 dibiarkan sebagai cadangan.

## Pola dan konvensi kode

- Komponen tidak pernah menyentuh localStorage: baca lewat `useTasks()`, ubah lewat fungsi di `taskActions.js`.
- Aksi dijalankan lewat `useAction(showToast)` → `run(() => aksi(...), "pesan sukses")`. Error (mis. penyimpanan penuh) otomatis jadi toast, dan data di layar tidak berubah.
- `taskStore` memperbarui cache hanya SETELAH penulisan berhasil.
- Desainer baru: tambah di `DESIGNERS` (`config.js`). Semua tombol Ambil, filter, checklist, dan analitik ikut otomatis.
- Teks UI Bahasa Indonesia, sentence case, tanpa emoji (aturan design system Infarm). Status selalu ada label teks, bukan hanya warna.
- Link diketik tanpa `https://` tetap diterima: pakai `normalizeUrl`, dan input link memakai `type="text" inputMode="url"` (bukan `type="url"`, karena validasi bawaan browser menolak link tanpa skema).

## Masalah yang diketahui

- **Data belum dibagi antar perangkat** (localStorage). Request dari perangkat requester belum sampai ke tim desain. Banner "Mode uji coba" tampil di semua halaman selama `STORAGE_MODE === "local"`.
- **PIN baru penghalang di UI.** Hash PIN ada di bundle JavaScript; tegakkan di server setelah Supabase.
- **Kapasitas localStorage sekitar 5 MB.** Gambar sudah dikompres, dan saat penuh muncul pesan jelas tanpa kehilangan data.

## Integrasi database (berikutnya: Supabase Free)

1. Tabel `tasks` dengan kolom sesuai model v6 (array → `jsonb` atau tabel anak). Bucket Storage `references` untuk gambar (upload dengan `cacheControl: "31536000"`, simpan URL).
2. Ganti isi `src/data/taskStore.js` dengan Supabase client; tanda tangan fungsinya tetap sama (`listTasks`, `getTask`, `subscribe`, `createTask`, `updateTask`, `deleteTask`). `subscribe` → Supabase Realtime.
3. Board hanya mengambil task yang belum Finish + Finish 30 hari terakhir. Task lama dimuat saat dibutuhkan (hemat egress).
4. RLS: `anon` hanya `SELECT` dan `INSERT` (status `request`). Aksi di `taskActions.js` (selain `submitRequest`) jadi fungsi RPC `security definer` yang menerima PIN dan mencocokkan hash di server.
5. `finishTask` dengan `deleteReferenceImages`: hapus file di Storage juga, bukan hanya URL-nya.
6. Ubah `STORAGE_MODE` di `config.js` menjadi `"supabase"` supaya banner "Mode uji coba" hilang.
