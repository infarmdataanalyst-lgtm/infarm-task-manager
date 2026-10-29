// Aksi alur kerja tim desain. Setiap fungsi di sini nantinya menjadi satu
// fungsi RPC Supabase yang memverifikasi PIN tim di server.

import { updateTask, deleteTask as removeTask, createTask } from "./taskStore";
import { newId } from "../lib/images";

const now = () => new Date().toISOString();

// Requester (tanpa PIN): hanya boleh membuat request baru.
export const submitRequest = (input) => createTask(input);

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

export const deleteTask = (id) => removeTask(id);

export const deleteReferenceImages = (id) => updateTask(id, { referenceImages: [], referenceImagesDeletedAt: now() });

export const setResultLinks = (id, resultLinks) => updateTask(id, { resultLinks });

// ─── Checklist ──────────────────────────────────────────────────

export const addChecklistItem = (id, text, assignee) =>
  updateTask(id, (t) => ({ checklist: [...t.checklist, { id: newId(), text, done: false, assignee }] }));

export const updateChecklistItem = (id, itemId, changes) =>
  updateTask(id, (t) => ({ checklist: t.checklist.map((c) => (c.id === itemId ? { ...c, ...changes } : c)) }));

export const removeChecklistItem = (id, itemId) =>
  updateTask(id, (t) => ({ checklist: t.checklist.filter((c) => c.id !== itemId) }));
