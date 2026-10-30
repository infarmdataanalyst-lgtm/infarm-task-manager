// Penyimpanan task di localStorage browser (mode uji coba, dipakai kalau Supabase belum diatur).
// Antarmuka fungsinya sama persis dengan supabaseStore.js; pemilihan ada di taskStore.js.
// Aturan pindah kolom, sesi waktu kerja, dan riwayat meniru trigger database (applyTransition).
//
// Aturan penting: cache di memori hanya diperbarui SETELAH penulisan berhasil.
// Kalau localStorage penuh, aksi gagal dengan pesan jelas dan data di layar tidak berubah.

import { blobToDataUrl, newId } from "../lib/images";
import { localMember } from "./auth";
import { applyTransition, arr, historyAction, normalizeChecklistItem, normalizeTask, taskChanges } from "./taskModel";

const KEY = "infarm_tasks_v8";
const HISTORY_KEY = "infarm_task_history_v8"; // { [taskId]: [{id, createdAt, actorName, action, changes}] }
const MAX_LOCAL_PDF = 1024 * 1024; // PDF lebih besar tidak disimpan isinya (localStorage terbatas ±5 MB)

export class StorageFullError extends Error {
  constructor() {
    super("Penyimpanan browser penuh (mode uji coba). Hapus beberapa task atau lampiran, lalu coba lagi.");
    this.name = "StorageFullError";
  }
}

function readRaw(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    if (e && (e.name === "QuotaExceededError" || e.code === 22 || e.code === 1014)) throw new StorageFullError();
    throw e;
  }
}

// ─── Cache & langganan perubahan ────────────────────────────────

let cache = null;
const listeners = new Set();

const getCache = () => {
  if (!cache) cache = arr(readRaw(KEY)).map(normalizeTask);
  return cache;
};

const notify = () => listeners.forEach((fn) => fn(cache));

function write(next) {
  save(KEY, next);
  cache = next;
  notify();
}

// Sinkron antar tab di browser yang sama.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    cache = null;
    getCache();
    notify();
  });
}

// ─── Riwayat (padanan tabel task_history) ───────────────────────

const actor = () => localMember()?.name || "sistem";

function logHistory(taskId, actorName, action, changes = []) {
  const all = readRaw(HISTORY_KEY) || {};
  all[taskId] = [{ id: newId(), createdAt: new Date().toISOString(), actorName, action, changes }, ...arr(all[taskId])];
  // Riwayat hanya pelengkap di mode uji coba: kalau penyimpanan penuh, aksi utamanya tetap jalan.
  try {
    save(HISTORY_KEY, all);
  } catch {}
}

function patchTask(id, patch, { log = true } = {}) {
  const list = getCache();
  const current = list.find((t) => t.id === id);
  if (!current) throw new Error("Task tidak ditemukan. Mungkin sudah dihapus.");
  if (current.deletedAt && localMember()?.role !== "admin") throw new Error("Task ini sudah dihapus. Hanya admin yang bisa memulihkannya.");
  const changes = typeof patch === "function" ? patch(current) : patch;
  const updated = normalizeTask({ ...applyTransition(current, changes), updatedAt: new Date().toISOString() });
  if (!current.deletedAt && updated.deletedAt) updated.deletedBy = localMember()?.email || null;
  write(list.map((t) => (t.id === id ? updated : t)));
  if (log) {
    const diff = taskChanges(current, updated);
    const action = !current.deletedAt && updated.deletedAt ? "dihapus" : current.deletedAt && !updated.deletedAt ? "dipulihkan" : historyAction(current.status, updated.status);
    if (diff.length || action === "dihapus" || action === "dipulihkan") logHistory(id, actor(), action, diff);
  }
  return updated;
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
  const attachments = [];
  for (const a of input.attachments || []) {
    const keepData = a.type !== "pdf" || a.size <= MAX_LOCAL_PDF;
    attachments.push({
      id: a.id, name: a.name, size: a.size, type: a.type, path: null,
      url: keepData ? await blobToDataUrl(a.blob) : null,
      thumbUrl: a.thumbBlob ? await blobToDataUrl(a.thumbBlob) : null,
    });
  }
  const task = normalizeTask({ ...input, attachments, id: newId(), status: "request", pic: null, createdAt: now, updatedAt: now });
  write([...getCache(), task]);
  logHistory(task.id, `${task.requesterName || "requester"} (requester)`, "dibuat");
  return task;
}

export async function updateTask(id, patch) {
  return patchTask(id, patch);
}

export async function listHistory(taskId) {
  return arr((readRaw(HISTORY_KEY) || {})[taskId]);
}

// ─── Checklist (padanan tabel task_checklist) ───────────────────

const summary = (c) => `${c.text} · ${c.assignee || "-"}${c.done ? " · selesai" : ""}`;

function changeChecklist(taskId, fn, before, after) {
  const updated = patchTask(taskId, (t) => ({ checklist: fn(t.checklist) }), { log: false });
  if (before !== after) logHistory(taskId, actor(), "checklist", [{ field: "checklist", before, after }]);
  return updated;
}

export async function addChecklistItem(taskId, text, assignee) {
  const t = await getTask(taskId);
  const item = normalizeChecklistItem({ id: newId(), text, assignee, position: t ? t.checklist.length : 0 });
  return changeChecklist(taskId, (list) => [...list, item], null, summary(item));
}

export async function updateChecklistItem(taskId, itemId, changes) {
  const t = await getTask(taskId);
  const old = t?.checklist.find((c) => c.id === itemId);
  if (!old) throw new Error("Item checklist tidak ditemukan.");
  const next = { ...old, ...changes };
  if ("done" in changes) next.doneAt = changes.done ? old.doneAt || new Date().toISOString() : null;
  return changeChecklist(taskId, (list) => list.map((c) => (c.id === itemId ? next : c)), summary(old), summary(next));
}

export async function removeChecklistItem(taskId, itemId) {
  const t = await getTask(taskId);
  const old = t?.checklist.find((c) => c.id === itemId);
  return changeChecklist(taskId, (list) => list.filter((c) => c.id !== itemId), old ? summary(old) : null, null);
}
