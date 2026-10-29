// Penyimpanan task di localStorage browser (mode uji coba, dipakai kalau Supabase belum diatur).
// Antarmuka fungsinya sama persis dengan supabaseStore.js; pemilihan ada di taskStore.js.
//
// Aturan penting: cache di memori hanya diperbarui SETELAH penulisan berhasil.
// Kalau localStorage penuh, aksi gagal dengan pesan jelas dan data di layar tidak berubah.

import { newId } from "../lib/images";
import { arr, historyAction, normalizeChecklistItem, normalizeTask, taskChanges } from "./taskModel";

const KEY = "infarm_tasks_v6";
const LEGACY_KEY = "infarm_tasks_v5";
const HISTORY_KEY = "infarm_task_history_v1"; // { [taskId]: [{id, createdAt, actor, action, changes}] }

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

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    if (e && (e.name === "QuotaExceededError" || e.code === 22 || e.code === 1014)) throw new StorageFullError();
    throw e;
  }
}

function write(next) {
  save(KEY, next);
  cache = next;
  notify();
}

// ─── Riwayat (padanan tabel task_history) ───────────────────────

const readHistory = () => readRaw(HISTORY_KEY) || {};

function logHistory(taskId, actor, action, changes = []) {
  const all = readHistory();
  const entry = { id: newId(), createdAt: new Date().toISOString(), actor, action, changes };
  all[taskId] = [entry, ...arr(all[taskId])];
  // Riwayat hanya pelengkap: kalau penyimpanan penuh, aksi utamanya tetap jalan.
  try {
    save(HISTORY_KEY, all);
  } catch {}
}

// Ubah satu task. actor: "tim" | "requester" | null (null = tidak dicatat di riwayat, mis. checklist).
function patchTask(id, patch, { actor = null, action, touch = true } = {}) {
  const list = getCache();
  const current = list.find((t) => t.id === id);
  if (!current) throw new Error("Task tidak ditemukan. Mungkin sudah dihapus.");
  const changes = typeof patch === "function" ? patch(current) : patch;
  const updated = normalizeTask({ ...current, ...changes, updatedAt: touch ? new Date().toISOString() : current.updatedAt });
  const diff = taskChanges(current, updated);
  if (actor === "requester" && !diff.length) throw new Error("Belum ada perubahan.");
  write(list.map((t) => (t.id === id ? updated : t)));
  if (actor && diff.length) logHistory(id, actor, action || historyAction(current.status, updated.status), diff);
  return updated;
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
  const task = normalizeTask({ ...input, id: newId(), status: "request", pic: null, checklist: [], createdAt: now, updatedAt: now });
  write([...getCache(), task]);
  logHistory(task.id, "requester", "dibuat");
  return task;
}

// Perubahan dari tim. patch: objek field baru, atau fungsi (task) => objek field baru.
export async function updateTask(id, patch) {
  return patchTask(id, patch, { actor: "tim" });
}

// Requester mengedit request-nya sendiri (hanya saat Request atau Todo).
export async function requesterUpdateTask(id, fields) {
  return patchTask(
    id,
    (t) => {
      if (t.status !== "request" && t.status !== "todo") throw new Error("Request ini sudah mulai dikerjakan, jadi tidak bisa diedit lagi. Hubungi PIC-nya langsung.");
      return { ...fields, requesterUpdatedAt: new Date().toISOString() };
    },
    { actor: "requester", action: "diedit" }
  );
}

export async function markSeen(id) {
  return patchTask(id, { picSeenAt: new Date().toISOString() }, { touch: false });
}

export async function deleteTask(id) {
  write(getCache().filter((t) => t.id !== id));
  const all = readHistory();
  if (all[id]) {
    delete all[id];
    try {
      save(HISTORY_KEY, all);
    } catch {}
  }
}

export async function listHistory(taskId) {
  return arr(readHistory()[taskId]);
}

// ─── Checklist (padanan tabel task_checklist) ───────────────────

export async function addChecklistItem(taskId, text, assignee) {
  return patchTask(taskId, (t) => ({
    checklist: [...t.checklist, normalizeChecklistItem({ id: newId(), text, assignee, position: t.checklist.length })],
  }));
}

export async function updateChecklistItem(taskId, itemId, changes) {
  return patchTask(taskId, (t) => ({
    checklist: t.checklist.map((c) => {
      if (c.id !== itemId) return c;
      const next = { ...c, ...changes };
      if ("done" in changes) next.doneAt = changes.done ? c.doneAt || new Date().toISOString() : null;
      return next;
    }),
  }));
}

export async function removeChecklistItem(taskId, itemId) {
  return patchTask(taskId, (t) => ({ checklist: t.checklist.filter((c) => c.id !== itemId) }));
}
