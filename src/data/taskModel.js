// Bentuk data task di aplikasi (camelCase) dan konversi ke/dari kolom database (snake_case).

import { newId } from "../lib/images";

export const arr = (v) => (Array.isArray(v) ? v : []);

export function normalizeChecklistItem(c, i = 0) {
  return {
    id: String(c.id ?? newId()),
    text: c.text || "",
    done: !!c.done,
    assignee: c.assignee || null,
    doneAt: c.doneAt ?? c.done_at ?? null,
    position: Number.isFinite(c.position) ? c.position : i,
  };
}

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
    checklist: arr(t.checklist).map(normalizeChecklistItem).sort((a, b) => a.position - b.position),
    createdAt: t.createdAt || new Date().toISOString(),
    assignedAt: t.assignedAt || null,
    startedAt: t.startedAt || null,
    finishedAt: t.finishedAt || null,
    referenceImagesDeletedAt: t.referenceImagesDeletedAt || null,
    requesterUpdatedAt: t.requesterUpdatedAt || null,
    picSeenAt: t.picSeenAt || null,
    updatedAt: t.updatedAt || t.createdAt || new Date().toISOString(),
  };
}

// Pasangan nama field aplikasi ↔ kolom tabel public.tasks (supabase/schema.sql).
// Checklist ada di tabel sendiri (task_checklist), jadi tidak ada di sini.
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
  createdAt: "created_at",
  assignedAt: "assigned_at",
  startedAt: "started_at",
  finishedAt: "finished_at",
  referenceImagesDeletedAt: "reference_images_deleted_at",
  requesterUpdatedAt: "requester_updated_at",
  picSeenAt: "pic_seen_at",
  updatedAt: "updated_at",
};

// row.checklist berisi baris task_checklist (di-embed lewat select "checklist:task_checklist(*)").
export function fromRow(row) {
  const t = {};
  for (const [field, column] of Object.entries(COLUMNS)) t[field] = row[column];
  t.checklist = arr(row.checklist);
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

// Field yang boleh diubah requester lewat halaman edit.
export const REQUESTER_FIELDS = ["title", "category", "division", "requesterName", "description", "dueDate", "referenceImages", "referenceLinks"];

// ─── Riwayat perubahan ──────────────────────────────────────────
// Bentuknya sama dengan task_changes() di supabase/schema.sql: [{field, before, after}],
// field memakai nama kolom database; gambar dicatat sebagai daftar nama, link sebagai daftar URL.

const HISTORY_FIELDS = [
  ["title", (t) => t.title],
  ["category", (t) => t.category],
  ["division", (t) => t.division],
  ["requester_name", (t) => t.requesterName],
  ["description", (t) => t.description],
  ["due_date", (t) => t.dueDate || null],
  ["status", (t) => t.status],
  ["pic", (t) => t.pic || null],
  ["reference_images", (t) => arr(t.referenceImages).map((i) => i.name)],
  ["reference_links", (t) => arr(t.referenceLinks).map((l) => l.url)],
  ["result_links", (t) => arr(t.resultLinks).map((l) => l.url)],
];

export function taskChanges(before, after) {
  const changes = [];
  for (const [field, get] of HISTORY_FIELDS) {
    const b = get(before);
    const a = get(after);
    if (JSON.stringify(b) !== JSON.stringify(a)) changes.push({ field, before: b, after: a });
  }
  return changes;
}

// Sama dengan task_action() di supabase/schema.sql.
export function historyAction(oldStatus, newStatus) {
  if (oldStatus === newStatus) return "diubah";
  if (oldStatus === "request" && newStatus === "todo") return "diambil";
  if (oldStatus === "finish" && newStatus === "on_progress") return "revisi";
  if (newStatus === "on_progress") return "dimulai";
  if (newStatus === "finish") return "selesai";
  if (newStatus === "request") return "dilepas";
  return "dikembalikan";
}

// ─── Turunan untuk tampilan ─────────────────────────────────────

// Requester mengubah request setelah tim terakhir membuka detailnya.
export const isUpdatedByRequester = (t) =>
  t.status !== "finish" && !!t.requesterUpdatedAt && (!t.picSeenAt || new Date(t.picSeenAt) < new Date(t.requesterUpdatedAt));

// Desainer selain PIC yang punya item checklist di task ini.
export const helpers = (t) => [...new Set(t.checklist.map((c) => c.assignee).filter((a) => a && a !== t.pic))];

// Task dihitung untuk seorang desainer bila ia PIC, atau punya item checklist yang belum selesai.
export const involves = (t, name) => t.pic === name || t.checklist.some((c) => c.assignee === name && !c.done);
