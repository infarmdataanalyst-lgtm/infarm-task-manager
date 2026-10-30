// Aksi alur kerja. Di mode Supabase, aturan (PIC wajib, link hasil wajib, waktu mulai/selesai,
// sesi waktu kerja, riwayat) ditegakkan database; di mode uji coba oleh localStore.

import * as store from "./taskStore";

// ─── Requester (tanpa login) ────────────────────────────────────

export const submitRequest = (input) => store.createTask(input);

// ─── Tim desain ─────────────────────────────────────────────────

// Request → On Progress dengan PIC yang dipilih (tombol Arum/Denny di kartu).
export const takeTask = (id, pic) => store.updateTask(id, { pic, status: "on_progress" });

// Pindah kolom maju/mundur. extra: { pic } dari Request, { delayReason } ke Delay, { resultLinks } ke Finish.
export const moveTask = (id, status, extra = {}) => {
  if (status === "finish" && extra.resultLinks && !extra.resultLinks.length) {
    return Promise.reject(new Error("Isi minimal satu link hasil desain."));
  }
  return store.updateTask(id, { ...extra, status });
};

export const changePic = (id, pic) => store.updateTask(id, { pic });

export const editTask = (id, fields) => store.updateTask(id, fields);

export const setResultLinks = (id, resultLinks) => store.updateTask(id, { resultLinks });

// Hapus = arsip: task hilang dari board, tetap tersimpan beserta riwayatnya. Admin bisa memulihkan.
export const deleteTask = (id) => store.updateTask(id, { deletedAt: new Date().toISOString() });

export const restoreTask = (id) => store.updateTask(id, { deletedAt: null });

export const listHistory = (id) => store.listHistory(id);

// ─── Checklist: tiap item bisa dikerjakan desainer berbeda ──────
// Setiap aksi hanya mengubah satu item, jadi centangan Denny dan Arum tidak saling menimpa.

export const addChecklistItem = (id, text, assignee) => store.addChecklistItem(id, text, assignee);

export const updateChecklistItem = (id, itemId, changes) => store.updateChecklistItem(id, itemId, changes);

export const removeChecklistItem = (id, itemId) => store.removeChecklistItem(id, itemId);
