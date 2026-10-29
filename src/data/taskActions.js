// Aksi alur kerja. Di mode Supabase, aksi tim berjalan lewat fungsi RPC ber-PIN
// dan aksi requester lewat requester_update_task (lihat supabase/schema.sql).

import * as store from "./taskStore";
import { REQUESTER_FIELDS } from "./taskModel";

const { updateTask, createTask } = store;

const now = () => new Date().toISOString();

// ─── Requester (tanpa PIN) ──────────────────────────────────────

export const submitRequest = (input) => createTask(input);

// Edit request sendiri selama status Request atau Todo. Hanya field di REQUESTER_FIELDS yang dikirim.
export const editRequest = (id, fields) => {
  const allowed = Object.fromEntries(Object.entries(fields).filter(([k]) => REQUESTER_FIELDS.includes(k)));
  return store.requesterUpdateTask(id, allowed);
};

export const canRequesterEdit = (task) => task.status === "request" || task.status === "todo";

// ─── Tim desain (PIN) ───────────────────────────────────────────

// Request → Todo, sekaligus menentukan PIC. Task tidak boleh masuk Todo tanpa PIC.
export const assignTask = (id, pic) =>
  updateTask(id, (t) => ({
    pic,
    status: t.status === "request" ? "todo" : t.status,
    assignedAt: t.assignedAt || now(),
  }));

export const changePic = (id, pic) => updateTask(id, { pic });

export const startTask = (id) => updateTask(id, (t) => ({ status: "on_progress", startedAt: t.startedAt || now() }));

export const backToTodo = (id) => updateTask(id, { status: "todo" });

export const backToRequest = (id) => updateTask(id, { status: "request", pic: null, assignedAt: null, startedAt: null });

// On Progress → Finish. Wajib minimal satu link hasil.
export const finishTask = (id, { resultLinks, deleteReferenceImages }) => {
  if (!resultLinks.length) return Promise.reject(new Error("Isi minimal satu link hasil desain."));
  return updateTask(id, (t) => ({
    status: "finish",
    finishedAt: now(),
    startedAt: t.startedAt || now(),
    resultLinks,
    ...(deleteReferenceImages && t.referenceImages.length
      ? { referenceImages: [], referenceImagesDeletedAt: now() }
      : {}),
  }));
};

// Revisi: Finish → On Progress. finishedAt dikosongkan karena task belum selesai lagi.
export const reviseTask = (id) => updateTask(id, { status: "on_progress", finishedAt: null });

export const editTask = (id, fields) => updateTask(id, fields);

export const deleteTask = (id) => store.deleteTask(id);

// Tim membuka detail task: badge "Diperbarui requester" hilang.
export const markSeen = (id) => store.markSeen(id);

export const listHistory = (id) => store.listHistory(id);

export const deleteReferenceImages = (id) => updateTask(id, { referenceImages: [], referenceImagesDeletedAt: now() });

export const setResultLinks = (id, resultLinks) => updateTask(id, { resultLinks });

// ─── Checklist: tiap item bisa dikerjakan desainer berbeda ──────
// Setiap aksi hanya mengubah satu item, jadi centangan Denny dan Arum tidak saling menimpa.

export const addChecklistItem = (id, text, assignee) => store.addChecklistItem(id, text, assignee);

export const updateChecklistItem = (id, itemId, changes) => store.updateChecklistItem(id, itemId, changes);

export const removeChecklistItem = (id, itemId) => store.removeChecklistItem(id, itemId);
