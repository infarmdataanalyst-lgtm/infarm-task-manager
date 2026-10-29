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

// Hash SHA-256 dari PIN tim (6 angka). Atur lewat environment variable
// REACT_APP_TEAM_PIN_SHA256 di Vercel. Kosong = halaman /tim tidak dikunci.
// Catatan: selama data masih di localStorage, PIN hanya penghalang di UI.
// Setelah Supabase terpasang, PIN wajib diverifikasi di server (lihat CLAUDE.md).
export const TEAM_PIN_SHA256 = (process.env.REACT_APP_TEAM_PIN_SHA256 || "").trim().toLowerCase();

// Mode penyimpanan saat ini. "local" = localStorage browser (sementara, sebelum Supabase).
export const STORAGE_MODE = "local";
