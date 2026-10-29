# infarm-task-manager

Aplikasi request desain untuk Tim Desain infarm.id.

- `/`: status semua request (publik)
- `/request`: form request desain
- `/tim`: board Kanban dan analitik tim desain (dilindungi PIN)

```bash
npm install
npm start
```

Database memakai Supabase. Cara menyiapkannya (akun, skrip database, PIN tim, Vercel): [docs/PANDUAN-SUPABASE.md](docs/PANDUAN-SUPABASE.md). Tanpa pengaturan Supabase, aplikasi berjalan dalam mode uji coba (data hanya di browser).

Dokumentasi struktur kode: [CLAUDE.md](CLAUDE.md).
