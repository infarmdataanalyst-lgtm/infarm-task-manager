// Konfigurasi aplikasi: daftar pilihan, status, desainer, dan PIN tim.

export const DESIGNERS = [
  { name: "Denny", color: "#00843b" },
  { name: "Arum", color: "#6b4e3d" },
];

export const designerColor = (name) =>
  DESIGNERS.find((d) => d.name === name)?.color || "#6b7280";

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

export const DIVISIONS = ["Sales Team", "Bidev Team", "HRD", "Marketing", "Management", "Lainnya"];

// Urutan status = urutan tahapan di stepper.
export const STATUSES = ["request", "todo", "on_progress", "finish"];

export const STATUS = {
  request: { label: "Request", step: 1 },
  todo: { label: "Todo", step: 2 },
  on_progress: { label: "On Progress", step: 3 },
  finish: { label: "Finish", step: 4 },
};

// Koneksi Supabase (database bersama). Atur di Vercel → Settings → Environment Variables:
// REACT_APP_SUPABASE_URL dan REACT_APP_SUPABASE_PUBLISHABLE_KEY (atau key lama: REACT_APP_SUPABASE_ANON_KEY).
// Keduanya aman berada di browser; keamanan data diatur oleh aturan di supabase/schema.sql.
export const SUPABASE_URL = (process.env.REACT_APP_SUPABASE_URL || "").trim();
export const SUPABASE_KEY = (process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY || "").trim();

// "supabase" kalau koneksi di atas diatur; selain itu "local" = localStorage browser (mode uji coba).
export const STORAGE_MODE = SUPABASE_URL && SUPABASE_KEY ? "supabase" : "local";

// Khusus mode lokal: hash SHA-256 dari PIN tim (REACT_APP_TEAM_PIN_SHA256). Kosong = /tim tidak dikunci.
// Di mode Supabase, PIN diatur lewat supabase/set-pin.sql dan dicek di server.
export const TEAM_PIN_SHA256 = (process.env.REACT_APP_TEAM_PIN_SHA256 || "").trim().toLowerCase();
