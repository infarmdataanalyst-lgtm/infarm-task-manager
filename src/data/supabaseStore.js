// Penyimpanan task di Supabase (database bersama + Storage untuk gambar referensi).
// Antarmuka fungsinya sama persis dengan localStore.js. Skema & aturan akses: supabase/schema.sql.
//
// - Requester (tanpa PIN): baca semua task, buat request baru, upload gambar referensi,
//   edit request lewat RPC requester_update_task (server menolak bila sudah On Progress/Finish).
// - Tim (dengan PIN): semua perubahan lewat RPC team_*; PIN dicek di server.
// - Checklist ada di tabel task_checklist (1 baris per item), di-embed ke task saat dibaca.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "../config";
import { clearPin, getPin } from "../lib/pin";
import { newId } from "../lib/images";
import { fromRow, normalizeChecklistItem, normalizeTask, toRow } from "./taskModel";

const BUCKET = "references";
const LIST_LIMIT = 500;
const SELECT_TASK = "*, checklist:task_checklist(*)";

let client = null;
const db = () => {
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  return client;
};

// ─── Pesan error yang bisa dipahami pengguna ────────────────────

function friendlyError(error) {
  const msg = `${error?.message || ""} ${error?.details || ""}`;
  if (msg.includes("invalid_pin")) {
    clearPin();
    window.dispatchEvent(new Event("infarm:pin-invalid"));
    return new Error("PIN tim salah atau sudah diganti. Masukkan PIN lagi.");
  }
  if (msg.includes("tasks_pic_wajib")) return new Error("Task harus punya PIC sebelum masuk Todo.");
  if (msg.includes("tasks_link_hasil_wajib")) return new Error("Isi minimal satu link hasil desain.");
  if (msg.includes("task_not_found")) return new Error("Task tidak ditemukan. Mungkin sudah dihapus.");
  if (msg.includes("checklist_not_found")) return new Error("Item checklist tidak ditemukan. Mungkin sudah dihapus.");
  if (msg.includes("edit_locked")) return new Error("Request ini sudah mulai dikerjakan, jadi tidak bisa diedit lagi. Hubungi PIC-nya langsung.");
  if (msg.includes("no_changes")) return new Error("Belum ada perubahan.");
  if (msg.includes("too_many_images")) return new Error("Maksimal 6 gambar per request.");
  if (msg.includes("task_checklist_text_check")) return new Error("Isi teks item checklist.");
  if (msg.includes("row-level security") || msg.includes("permission denied")) return new Error("Aksi ini tidak diizinkan.");
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

const replaceInCache = (task) => {
  cache = cache ? (cache.some((t) => t.id === task.id) ? cache.map((t) => (t.id === task.id ? task : t)) : [task, ...cache]) : [task];
  notify();
};

// Baris dari RPC tidak membawa checklist; pakai checklist yang sudah ada di cache.
const withChecklist = (row, current) => ({ ...fromRow(row), checklist: current?.checklist || [] });

// ─── Gambar referensi ───────────────────────────────────────────

async function uploadImage(taskId, img) {
  const blob = await (await fetch(img.dataUrl)).blob();
  const path = `${taskId}/${img.id}.jpg`;
  must(await db().storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false }));
  const { data } = db().storage.from(BUCKET).getPublicUrl(path);
  return { id: img.id, name: img.name, size: img.size, path, url: data.publicUrl };
}

async function removeImages(images) {
  const paths = images.map((i) => i.path).filter(Boolean);
  if (!paths.length) return;
  // Kalau gagal, task tetap benar; file yatim bisa dibersihkan belakangan.
  await db().storage.from(BUCKET).remove(paths).catch(() => {});
}

// ─── API publik (sama dengan localStore.js) ─────────────────────

export class StorageFullError extends Error {}

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

export async function createTask(input) {
  const id = newId();
  const images = [];
  for (const img of input.referenceImages || []) images.push(await uploadImage(id, img));
  const task = normalizeTask({ ...input, id, status: "request", pic: null, referenceImages: images });
  const { createdAt, updatedAt, assignedAt, startedAt, finishedAt, referenceImagesDeletedAt, requesterUpdatedAt, picSeenAt, checklist, ...fields } = task;
  const row = must(await db().from("tasks").insert(toRow(fields)).select().single());
  const created = fromRow(row);
  replaceInCache(created);
  return created;
}

async function removeUnusedImages(before, after) {
  const kept = new Set(after.referenceImages.map((i) => i.path));
  await removeImages(before.referenceImages.filter((i) => !kept.has(i.path)));
}

// Perubahan dari tim. patch: objek field baru, atau fungsi (task) => objek field baru.
export async function updateTask(id, patch) {
  const current = await getTask(id);
  if (!current) throw new Error("Task tidak ditemukan. Mungkin sudah dihapus.");
  const changes = typeof patch === "function" ? patch(current) : patch;
  const row = must(await db().rpc("team_update_task", { p_pin: getPin(), p_id: id, p_patch: toRow(changes) }));
  const updated = withChecklist(row, current);
  replaceInCache(updated);
  if (changes.referenceImages) await removeUnusedImages(current, updated);
  return updated;
}

// Requester mengedit request-nya sendiri. Gambar baru (punya dataUrl) di-upload dulu.
export async function requesterUpdateTask(id, fields) {
  const current = await getTask(id);
  if (!current) throw new Error("Task tidak ditemukan. Mungkin sudah dihapus.");
  const changes = { ...fields };
  if (fields.referenceImages) {
    changes.referenceImages = [];
    for (const img of fields.referenceImages) changes.referenceImages.push(img.dataUrl ? await uploadImage(id, img) : img);
  }
  let row;
  try {
    row = must(await db().rpc("requester_update_task", { p_id: id, p_patch: toRow(changes) }));
  } catch (e) {
    // Simpan gagal: gambar yang baru saja di-upload tidak terpakai.
    await removeImages(changes.referenceImages?.filter((i) => !current.referenceImages.some((c) => c.path === i.path)) || []);
    throw e;
  }
  const updated = withChecklist(row, current);
  replaceInCache(updated);
  if (changes.referenceImages) await removeUnusedImages(current, updated);
  return updated;
}

export async function markSeen(id) {
  const current = await getTask(id);
  const row = must(await db().rpc("team_mark_seen", { p_pin: getPin(), p_id: id }));
  const updated = withChecklist(row, current);
  replaceInCache(updated);
  return updated;
}

export async function deleteTask(id) {
  const current = await getTask(id);
  must(await db().rpc("team_delete_task", { p_pin: getPin(), p_id: id }));
  cache = (cache || []).filter((t) => t.id !== id);
  notify();
  if (current) await removeImages(current.referenceImages);
}

export async function listHistory(taskId) {
  const rows = must(await db().from("task_history").select("*").eq("task_id", taskId).order("created_at", { ascending: false }).limit(100));
  return rows.map((r) => ({ id: String(r.id), createdAt: r.created_at, actor: r.actor, action: r.action, changes: r.changes || [] }));
}

// ─── Checklist: setiap aksi hanya mengubah satu item ────────────

function setChecklist(taskId, fn) {
  const task = cache?.find((t) => t.id === taskId);
  if (!task) return;
  replaceInCache({ ...task, checklist: fn(task.checklist).sort((a, b) => a.position - b.position) });
}

export async function addChecklistItem(taskId, text, assignee) {
  const row = must(await db().rpc("team_add_checklist_item", { p_pin: getPin(), p_task_id: taskId, p_text: text, p_assignee: assignee }));
  setChecklist(taskId, (list) => [...list, normalizeChecklistItem(row)]);
}

export async function updateChecklistItem(taskId, itemId, changes) {
  const row = must(await db().rpc("team_update_checklist_item", { p_pin: getPin(), p_id: itemId, p_patch: changes }));
  setChecklist(taskId, (list) => list.map((c) => (c.id === itemId ? normalizeChecklistItem(row) : c)));
}

export async function removeChecklistItem(taskId, itemId) {
  must(await db().rpc("team_delete_checklist_item", { p_pin: getPin(), p_id: itemId }));
  setChecklist(taskId, (list) => list.filter((c) => c.id !== itemId));
}

// Dipakai layar PIN: cek PIN di server.
export async function checkPin(pin) {
  return !!must(await db().rpc("team_check_pin", { p_pin: pin }));
}
