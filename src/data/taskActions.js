// Aksi alur kerja. Di mode Supabase, aturan (PIC wajib, hanya PIC/admin yang memulai, waktu mulai/selesai,
// sesi waktu kerja, riwayat) ditegakkan database; di mode uji coba oleh localStore.

import * as store from "./taskStore";

// ─── Requester (tanpa login) ────────────────────────────────────

export const submitRequest = (input) => store.createTask(input);

// ─── Tim desain ─────────────────────────────────────────────────

// Tentukan PIC di kolom Request (tombol Arum/Denny di kartu). Task tetap di Request;
// PIC sendiri (atau admin) yang memindahkannya ke On Progress lewat startTask/moveTask.
export const assignPic = (id, pic) => store.updateTask(id, { pic });

// Request → On Progress oleh PIC atau admin.
export const startTask = (id) => store.updateTask(id, { status: "on_progress" });

// Pindah kolom maju/mundur. extra: { pic } dari Request, { delayReason } ke Delay, { resultLinks } ke Finish (opsional).
export const moveTask = (id, status, extra = {}) => store.updateTask(id, { ...extra, status });

export const changePic = (id, pic) => store.updateTask(id, { pic });

export const editTask = (id, fields) => store.updateTask(id, fields);

export const setResultLinks = (id, resultLinks) => store.updateTask(id, { resultLinks });

// Lampiran oleh tim (maks 5 per task). drafts = hasil prepareAttachment (lib/images.js).
export const addAttachments = (id, drafts) => store.addAttachments(id, drafts);
export const removeAttachment = (id, attachmentId) => store.removeAttachment(id, attachmentId);

// Hapus = arsip: task hilang dari board, tetap tersimpan beserta riwayatnya. Admin bisa memulihkan.
export const deleteTask = (id) => store.updateTask(id, { deletedAt: new Date().toISOString() });

export const restoreTask = (id) => store.updateTask(id, { deletedAt: null });

export const listHistory = (id) => store.listHistory(id);

// Task Finish lama (di luar yang dimuat board) dicari langsung di database; getTask untuk link langsung.
export const searchTasks = (query) => store.searchTasks(query);
export const getTask = (id) => store.getTask(id);

// Halaman Audit (admin): semua riwayat lintas task.
export const listAllHistory = (limit) => store.listAllHistory(limit);

// Penanda "sudah dilihat" per akun: badge "Baru" hilang setelah detail task dibuka akun itu.
export const listReads = (email) => store.listReads(email);
export const markRead = (id, email) => store.markRead(id, email);

// ─── Checklist: tiap item bisa dikerjakan desainer berbeda ──────
// Setiap aksi hanya mengubah satu item, jadi centangan Denny dan Arum tidak saling menimpa.

export const addChecklistItem = (id, text, assignee) => store.addChecklistItem(id, text, assignee);

export const updateChecklistItem = (id, itemId, changes) => store.updateChecklistItem(id, itemId, changes);

export const removeChecklistItem = (id, itemId) => store.removeChecklistItem(id, itemId);
