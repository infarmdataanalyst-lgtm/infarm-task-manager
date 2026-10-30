// Konfigurasi aplikasi: daftar pilihan, status, dan koneksi Supabase.
// Anggota tim (desainer + admin) diatur di database (tabel team_members), bukan di sini.

export const CATEGORIES = [
  "Social Media Post",
  "Banner Marketplace",
  "Promo Material",
  "Kemasan Baru",
  "Revisi Kemasan",
  "Key Visual Marketplace",
  "Email Template",
  "Product Photo",
  "Infografis",
  "Struktur Organisasi",
  "Poster",
  "Lainnya",
];

export const DIVISIONS = ["Sales Team", "Bidev Team", "HRD", "Marketing", "Management", "FAT", "Lainnya"];

// Urutan status = urutan kolom Kanban.
export const STATUSES = ["request", "on_progress", "delay", "finish"];

export const STATUS = {
  request: { label: "Request", note: "belum ada PIC" },
  on_progress: { label: "On Progress", note: "waktu berjalan" },
  delay: { label: "Delay", note: "waktu berhenti" },
  finish: { label: "Finish", note: "30 hari terakhir" },
};

// Lampiran request.
export const MAX_ATTACHMENTS = 5;
export const MAX_PDF_BYTES = 5 * 1024 * 1024;

// Koneksi Supabase (database bersama). Atur di Vercel → Settings → Environment Variables:
// REACT_APP_SUPABASE_URL dan REACT_APP_SUPABASE_PUBLISHABLE_KEY (atau key lama: REACT_APP_SUPABASE_ANON_KEY).
// Keduanya aman berada di browser; keamanan data diatur oleh aturan di supabase/schema.sql.
export const SUPABASE_URL = (process.env.REACT_APP_SUPABASE_URL || "").trim();
export const SUPABASE_KEY = (process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY || "").trim();

// "supabase" kalau koneksi di atas diatur; selain itu "local" = localStorage browser (mode uji coba).
export const STORAGE_MODE = SUPABASE_URL && SUPABASE_KEY ? "supabase" : "local";

// Mode uji coba: akun tiruan pengganti login Google.
export const LOCAL_MEMBERS = [
  { email: "arum@contoh.id", name: "Arum", role: "designer", color: "#6b4e3d", active: true },
  { email: "denny@contoh.id", name: "Denny", role: "designer", color: "#00843b", active: true },
  { email: "spv@contoh.id", name: "SPV", role: "admin", color: "#3f3f46", active: true },
];
