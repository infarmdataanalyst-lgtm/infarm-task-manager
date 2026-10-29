// Penyimpanan task di localStorage browser (mode uji coba, dipakai kalau Supabase belum diatur).
// Antarmuka fungsinya sama persis dengan supabaseStore.js; pemilihan ada di taskStore.js.
//
// Aturan penting: cache di memori hanya diperbarui SETELAH penulisan berhasil.
// Kalau localStorage penuh, aksi gagal dengan pesan jelas dan data di layar tidak berubah.

import { newId } from "../lib/images";
import { arr, normalizeTask } from "./taskModel";

const KEY = "infarm_tasks_v6";
const LEGACY_KEY = "infarm_tasks_v5";

export class StorageFullError extends Error {
  constructor() {
    super("Penyimpanan browser penuh. Hapus gambar referensi dari task yang sudah selesai, lalu coba lagi.");
    this.name = "StorageFullError";
  }
}

// ─── Migrasi data lama ──────────────────────────────────────────

// Task contoh dari versi lama; tidak ikut dimigrasi.
const LEGACY_DEMO_TITLES = new Set([
  "Social Media Post - Promo Lebaran",
  "Banner Marketplace - Flash Sale",
  "Desain Kemasan - Premium Line",
  "Template Loker - Desainer Grafis",
]);

const dayToIso = (ymd) => (ymd ? new Date(`${ymd}T09:00:00`).toISOString() : null);

// Format v5 (App.js lama) → format v6.
function fromLegacy(t) {
  const created = dayToIso(t.createdDate);
  return normalizeTask({
    id: t.id,
    title: t.title,
    category: t.category,
    division: t.requestedBy,
    requesterName: t.requesterName,
    description: t.description,
    dueDate: t.dueDate,
    status: t.status,
    pic: t.pic,
    // Lampiran lama non-gambar hanya berisi nama file (tanpa isi), jadi tidak dibawa.
    referenceImages: arr(t.attachments)
      .filter((a) => a.type === "image" && a.dataUrl)
      .map((a) => ({ id: String(a.id), name: a.name, size: 0, dataUrl: a.dataUrl })),
    referenceLinks: arr(t.attachmentLinks).map((l) => ({ id: String(l.id ?? newId()), url: l.url || String(l) })),
    resultLinks: arr(t.resultLinks).map((l) => ({ id: String(l.id ?? newId()), url: l.url })),
    checklist: arr(t.checklists).map((c) => ({ id: String(c.id), text: c.text, done: !!c.done, assignee: c.assignee || null })),
    createdAt: created,
    assignedAt: t.pic ? created : null,
    finishedAt: t.status === "finish" ? created : null,
  });
}

function readRaw(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function load() {
  const current = readRaw(KEY);
  if (Array.isArray(current)) return current.map(normalizeTask);
  const legacy = readRaw(LEGACY_KEY);
  if (Array.isArray(legacy)) {
    // Data lama dibiarkan di LEGACY_KEY sebagai cadangan.
    const migrated = legacy.filter((t) => !LEGACY_DEMO_TITLES.has(t.title)).map(fromLegacy);
    try {
      localStorage.setItem(KEY, JSON.stringify(migrated));
    } catch {
      // Gagal simpan hasil migrasi: tetap tampilkan, akan dicoba lagi saat ada perubahan.
    }
    return migrated;
  }
  return [];
}

// ─── Cache & langganan perubahan ────────────────────────────────

let cache = null;
const listeners = new Set();

const getCache = () => {
  if (!cache) cache = load();
  return cache;
};

const notify = () => listeners.forEach((fn) => fn(cache));

function write(next) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch (e) {
    if (e && (e.name === "QuotaExceededError" || e.code === 22 || e.code === 1014)) throw new StorageFullError();
    throw e;
  }
  cache = next;
  notify();
}

// Sinkron antar tab di browser yang sama (pengganti polling 3 detik).
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    cache = load();
    notify();
  });
}

// ─── API publik ─────────────────────────────────────────────────

export async function listTasks() {
  return getCache();
}

export async function getTask(id) {
  return getCache().find((t) => t.id === id) || null;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function createTask(input) {
  const now = new Date().toISOString();
  const task = normalizeTask({ ...input, id: newId(), status: "request", pic: null, createdAt: now, updatedAt: now });
  write([...getCache(), task]);
  return task;
}

// patch: objek field baru, atau fungsi (task) => objek field baru.
export async function updateTask(id, patch) {
  const list = getCache();
  const current = list.find((t) => t.id === id);
  if (!current) throw new Error("Task tidak ditemukan. Mungkin sudah dihapus.");
  const changes = typeof patch === "function" ? patch(current) : patch;
  const updated = normalizeTask({ ...current, ...changes, updatedAt: new Date().toISOString() });
  write(list.map((t) => (t.id === id ? updated : t)));
  return updated;
}

export async function deleteTask(id) {
  write(getCache().filter((t) => t.id !== id));
}
