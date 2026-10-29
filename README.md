# infarm-task-manager

Aplikasi request desain untuk Tim Desain infarm.id.

- `/`: status semua request (publik)
- `/request`: form request desain
- `/tim`: board Kanban dan analitik tim desain (dilindungi PIN)

```bash
npm install
npm start
```

PIN tim diatur lewat environment variable `REACT_APP_TEAM_PIN_SHA256` (hash SHA-256 dari PIN 6 angka). Dokumentasi struktur kode dan rencana integrasi database ada di [CLAUDE.md](CLAUDE.md).
