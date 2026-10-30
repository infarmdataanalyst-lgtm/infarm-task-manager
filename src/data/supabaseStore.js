// Penyimpanan task di Supabase (database bersama + Storage untuk lampiran).
// Antarmuka fungsinya sama persis dengan localStore.js. Skema & aturan akses: supabase/schema.sql.
//
// - Requester (tanpa login): hanya createTask (upload lampiran + insert, tanpa membaca balik).
// - Anggota tim (login Google): baca dan ubah langsung; database yang menegakkan aturan,
//   mencatat riwayat, dan membuka/menutup sesi waktu kerja (trigger).

import { STORAGE_MODE } from "../config";
import { newId } from "../lib/images";
import { db } from "./supabaseClient";
import { fromRow, normalizeChecklistItem, normalizeTask, toRow } from "./taskModel";

const BUCKET = "references";
const LIST_LIMIT = 500;
const SELECT_TASK = "*, checklist:task_checklist(*), workSessions:work_sessions(started_at, ended_at)";

// ─── Pesan error yang bisa dipahami pengguna ────────────────────

function friendlyError(error) {
  const msg = `${error?.message || ""} ${error?.details || ""} ${error?.code || ""}`;
  if (msg.includes("tasks_pic_wajib")) return new Error("Pilih PIC dulu sebelum memindah task dari Request.");
  if (msg.includes("tasks_link_hasil_wajib")) return new Error("Isi minimal satu link hasil desain.");
  if (msg.includes("tasks_lampiran_maks")) return new Error("Maksimal 5 lampiran per request.");
  if (msg.includes("task_terhapus")) return new Error("Task ini sudah dihapus. Hanya admin yang bisa memulihkannya.");
  if (msg.includes("PGRST116")) return new Error("Task tidak ditemukan atau kamu tidak punya akses.");
  if (msg.includes("JWT") || msg.includes("PGRST301")) return new Error("Sesi login berakhir. Muat ulang halaman lalu masuk lagi.");
  if (msg.includes("row-level security") || msg.includes("permission denied") || msg.includes("42501")) {
    return new Error("Aksi ini tidak diizinkan untuk akunmu.");
  }
  if (msg.includes("Payload too large") || msg.includes("exceeded the maximum")) return new Error("File terlalu besar (maks 5 MB).");
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) return new Error("Tidak bisa terhubung ke server. Periksa koneksi internet lalu coba lagi.");
  return new Error(error?.message || "Terjadi kesalahan di server. Coba lagi.");
}

const must = ({ data, error }) => {
  if (error) throw friendlyError(error);
  return data;
};

// ─── Cache & realtime ───────────────────────────────────────────

let cache = null;
let loading = null;
const listeners = new Set();
let channel = null;
let refetchTimer = null;

const notify = () => listeners.forEach((fn) => fn(cache));

async function fetchAll() {
  const rows = must(await db().from("tasks").select(SELECT_TASK).order("created_at", { ascending: false }).limit(LIST_LIMIT));
  cache = rows.map(fromRow);
  return cache;
}

// Banyak perubahan berdekatan cukup dibalas satu kali ambil ulang.
function scheduleRefetch() {
  clearTimeout(refetchTimer);
  refetchTimer = setTimeout(() => fetchAll().then(notify).catch(() => {}), 300);
}

function ensureRealtime() {
  if (channel) return;
  channel = db()
    .channel("tasks-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, scheduleRefetch)
    .on("postgres_changes", { event: "*", schema: "public", table: "task_checklist" }, scheduleRefetch)
    .subscribe();
}

// Setelah login/keluar: buang cache dan ambil ulang dengan hak akses yang baru.
if (STORAGE_MODE === "supabase") {
  db().auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
      cache = null;
      if (listeners.size) fetchAll().then(notify).catch(() => {});
    }
  });
}

const replaceInCache = (task) => {
  cache = cache ? (cache.some((t) => t.id === task.id) ? cache.map((t) => (t.id === task.id ? task : t)) : [task, ...cache]) : [task];
  notify();
};

// ─── Lampiran ───────────────────────────────────────────────────

async function uploadBlob(path, blob, contentType) {
  must(await db().storage.from(BUCKET).upload(path, blob, { contentType, cacheControl: "31536000", upsert: false }));
  return db().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// Lampiran draf (punya blob) → objek tersimpan { id, name, size, type, path, url, thumbPath, thumbUrl }.
async function uploadAttachment(taskId, a) {
  const ext = a.type === "pdf" ? "pdf" : "jpg";
  const path = `${taskId}/${a.id}.${ext}`;
  const url = await uploadBlob(path, a.blob, a.type === "pdf" ? "application/pdf" : "image/jpeg");
  let thumbPath = null;
  let thumbUrl = null;
  if (a.thumbBlob) {
    thumbPath = `${taskId}/${a.id}-thumb.jpg`;
    thumbUrl = await uploadBlob(thumbPath, a.thumbBlob, "image/jpeg");
  }
  return { id: a.id, name: a.name, size: a.size, type: a.type, path, url, thumbPath, thumbUrl };
}

const attachmentPaths = (list) => list.flatMap((a) => [a.path, a.thumbPath]).filter(Boolean);

async function removeFiles(paths) {
  if (!paths.length) return;
  // Kalau gagal, task tetap benar; file yatim bisa dibersihkan belakangan.
  await db().storage.from(BUCKET).remove(paths).catch(() => {});
}

// ─── API publik (sama dengan localStore.js) ─────────────────────

export async function listTasks() {
  ensureRealtime();
  if (cache) return cache;
  if (!loading) loading = fetchAll().finally(() => (loading = null));
  return loading;
}

export async function getTask(id) {
  const cached = cache?.find((t) => t.id === id);
  if (cached) return cached;
  const row = must(await db().from("tasks").select(SELECT_TASK).eq("id", id).maybeSingle());
  return row ? fromRow(row) : null;
}

export function subscribe(fn) {
  listeners.add(fn);
  ensureRealtime();
  return () => listeners.delete(fn);
}

// Requester mengirim request. Requester tidak bisa membaca tabel, jadi yang dikembalikan
// adalah isian yang dikirim (dipakai halaman "Request sudah masuk").
export async function createTask(input) {
  const id = newId();
  const uploaded = [];
  for (const a of input.attachments || []) uploaded.push(await uploadAttachment(id, a));
  const task = normalizeTask({ ...input, id, attachments: uploaded, status: "request", pic: null });
  const { title, category, division, requesterName, description, dueDate, attachments, referenceLinks } = task;
  must(await db().from("tasks").insert(toRow({ id, title, category, division, requesterName, description, dueDate, attachments, referenceLinks })));
  return task;
}

// Perubahan dari tim. patch: objek field baru, atau fungsi (task) => objek field baru.
// Aturan pindah kolom (PIC dilepas, waktu mulai/selesai, sesi kerja) dijalankan trigger database.
export async function updateTask(id, patch) {
  const current = await getTask(id);
  if (!current) throw new Error("Task tidak ditemukan. Mungkin sudah dihapus.");
  const changes = typeof patch === "function" ? patch(current) : patch;
  must(await db().from("tasks").update(toRow(changes)).eq("id", id).select("id").single());
  // Baca ulang terpisah: sesi waktu kerja dibuat trigger SETELAH update, jadi tidak ikut terbaca di permintaan yang sama.
  const updated = fromRow(must(await db().from("tasks").select(SELECT_TASK).eq("id", id).single()));
  replaceInCache(updated);
  if (changes.attachments) {
    const kept = new Set(attachmentPaths(updated.attachments));
    await removeFiles(attachmentPaths(current.attachments).filter((p) => !kept.has(p)));
  }
  return updated;
}

export async function listHistory(taskId) {
  const rows = must(await db().from("task_history").select("*").eq("task_id", taskId).order("created_at", { ascending: false }).limit(200));
  return rows.map((r) => ({ id: String(r.id), createdAt: r.created_at, actorName: r.actor_name, actorEmail: r.actor_email, action: r.action, changes: r.changes || [] }));
}

// ─── Checklist: setiap aksi hanya mengubah satu item ────────────

function setChecklist(taskId, fn) {
  const task = cache?.find((t) => t.id === taskId);
  if (!task) return;
  replaceInCache({ ...task, checklist: fn(task.checklist).sort((a, b) => a.position - b.position) });
}

export async function addChecklistItem(taskId, text, assignee) {
  const task = await getTask(taskId);
  const position = task ? Math.max(-1, ...task.checklist.map((c) => c.position)) + 1 : 0;
  const row = must(await db().from("task_checklist").insert({ task_id: taskId, text, assignee, position }).select().single());
  setChecklist(taskId, (list) => [...list, normalizeChecklistItem(row)]);
}

export async function updateChecklistItem(taskId, itemId, changes) {
  const row = must(await db().from("task_checklist").update(changes).eq("id", itemId).select().single());
  setChecklist(taskId, (list) => list.map((c) => (c.id === itemId ? normalizeChecklistItem(row) : c)));
}

export async function removeChecklistItem(taskId, itemId) {
  must(await db().from("task_checklist").delete().eq("id", itemId));
  setChecklist(taskId, (list) => list.filter((c) => c.id !== itemId));
}
