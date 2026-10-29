// Bentuk data task di aplikasi (camelCase) dan konversi ke/dari kolom database (snake_case).

import { newId } from "../lib/images";

export const arr = (v) => (Array.isArray(v) ? v : []);

export function normalizeTask(t) {
  return {
    id: String(t.id ?? newId()),
    title: t.title || "",
    category: t.category || "Lainnya",
    division: t.division || "Lainnya",
    requesterName: t.requesterName || "",
    description: t.description || "",
    dueDate: t.dueDate || "",
    status: t.status || "request",
    pic: t.pic || null,
    referenceImages: arr(t.referenceImages),
    referenceLinks: arr(t.referenceLinks),
    resultLinks: arr(t.resultLinks),
    checklist: arr(t.checklist),
    createdAt: t.createdAt || new Date().toISOString(),
    assignedAt: t.assignedAt || null,
    startedAt: t.startedAt || null,
    finishedAt: t.finishedAt || null,
    referenceImagesDeletedAt: t.referenceImagesDeletedAt || null,
    updatedAt: t.updatedAt || t.createdAt || new Date().toISOString(),
  };
}

// Pasangan nama field aplikasi ↔ kolom tabel public.tasks (supabase/schema.sql).
export const COLUMNS = {
  id: "id",
  title: "title",
  category: "category",
  division: "division",
  requesterName: "requester_name",
  description: "description",
  dueDate: "due_date",
  status: "status",
  pic: "pic",
  referenceImages: "reference_images",
  referenceLinks: "reference_links",
  resultLinks: "result_links",
  checklist: "checklist",
  createdAt: "created_at",
  assignedAt: "assigned_at",
  startedAt: "started_at",
  finishedAt: "finished_at",
  referenceImagesDeletedAt: "reference_images_deleted_at",
  updatedAt: "updated_at",
};

export function fromRow(row) {
  const t = {};
  for (const [field, column] of Object.entries(COLUMNS)) t[field] = row[column];
  return normalizeTask(t);
}

// Hanya field yang ada di objek yang dikonversi (dipakai untuk patch parsial).
export function toRow(fields) {
  const row = {};
  for (const [field, value] of Object.entries(fields)) {
    if (!(field in COLUMNS)) continue;
    row[COLUMNS[field]] = field === "dueDate" && !value ? null : value;
  }
  return row;
}
