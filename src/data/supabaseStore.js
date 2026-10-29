// Penyimpanan task di Supabase (database bersama + Storage untuk gambar referensi).
// Antarmuka fungsinya sama persis dengan localStore.js. Skema & aturan akses: supabase/schema.sql.
//
// - Requester (tanpa PIN): baca semua task, buat request baru, upload gambar referensi.
// - Tim (dengan PIN): semua perubahan lewat RPC team_update_task / team_delete_task; PIN dicek di server.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "../config";
import { clearPin, getPin } from "../lib/pin";
import { newId } from "../lib/images";
import { fromRow, normalizeTask, toRow } from "./taskModel";

const BUCKET = "references";
const LIST_LIMIT = 500;

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
  const rows = must(await db().from("tasks").select("*").order("created_at", { ascending: false }).limit(LIST_LIMIT));
  cache = rows.map(fromRow);
  return cache;
}

function ensureRealtime() {
  if (channel) return;
  channel = db()
    .channel("tasks-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
      // Banyak perubahan berdekatan cukup dibalas satu kali ambil ulang.
      clearTimeout(refetchTimer);
      refetchTimer = setTimeout(() => fetchAll().then(notify).catch(() => {}), 300);
    })
    .subscribe();
}

const replaceInCache = (task) => {
  cache = cache ? (cache.some((t) => t.id === task.id) ? cache.map((t) => (t.id === task.id ? task : t)) : [task, ...cache]) : [task];
  notify();
};

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
  const row = must(await db().from("tasks").select("*").eq("id", id).maybeSingle());
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
  const { createdAt, updatedAt, assignedAt, startedAt, finishedAt, referenceImagesDeletedAt, ...fields } = task;
  const row = must(await db().from("tasks").insert(toRow(fields)).select().single());
  const created = fromRow(row);
  replaceInCache(created);
  return created;
}

// patch: objek field baru, atau fungsi (task) => objek field baru.
export async function updateTask(id, patch) {
  const current = await getTask(id);
  if (!current) throw new Error("Task tidak ditemukan. Mungkin sudah dihapus.");
  const changes = typeof patch === "function" ? patch(current) : patch;
  const row = must(await db().rpc("team_update_task", { p_pin: getPin(), p_id: id, p_patch: toRow(changes) }));
  const updated = fromRow(row);
  replaceInCache(updated);
  if (changes.referenceImages) {
    const kept = new Set(updated.referenceImages.map((i) => i.path));
    await removeImages(current.referenceImages.filter((i) => !kept.has(i.path)));
  }
  return updated;
}

export async function deleteTask(id) {
  const current = await getTask(id);
  must(await db().rpc("team_delete_task", { p_pin: getPin(), p_id: id }));
  cache = (cache || []).filter((t) => t.id !== id);
  notify();
  if (current) await removeImages(current.referenceImages);
}

// Dipakai layar PIN: cek PIN di server.
export async function checkPin(pin) {
  return !!must(await db().rpc("team_check_pin", { p_pin: pin }));
}
