# infarm-task-manager

Aplikasi request desain untuk Tim Desain infarm.id.

- `/`: form request desain (publik, tanpa login)
- `/tim`: board Kanban dan analitik tim desain (login Google, hanya email anggota)

```bash
npm install
npm start
```

Database memakai Supabase. Cara menyiapkannya (Supabase, login Google, skrip database, anggota tim, Vercel): [docs/PANDUAN-SUPABASE.md](docs/PANDUAN-SUPABASE.md). Tanpa pengaturan Supabase, aplikasi berjalan dalam mode uji coba (data hanya di browser).

Dokumentasi struktur kode: [CLAUDE.md](CLAUDE.md).
