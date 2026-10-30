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

const normalizeSession = (w) => ({ startedAt: w.startedAt ?? w.started_at, endedAt: w.endedAt ?? w.ended_at ?? null });

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
    delayReason: t.delayReason || null,
    attachments: arr(t.attachments),
    referenceLinks: arr(t.referenceLinks),
    resultLinks: arr(t.resultLinks),
    checklist: arr(t.checklist).map(normalizeChecklistItem).sort((a, b) => a.position - b.position),
    workSessions: arr(t.workSessions).map(normalizeSession).sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt)),
    createdAt: t.createdAt || new Date().toISOString(),
    startedAt: t.startedAt || null,
    finishedAt: t.finishedAt || null,
    attachmentsDeletedAt: t.attachmentsDeletedAt || null,
    deletedAt: t.deletedAt || null,
    deletedBy: t.deletedBy || null,
    updatedAt: t.updatedAt || t.createdAt || new Date().toISOString(),
  };
}

// Pasangan nama field aplikasi ↔ kolom tabel public.tasks (supabase/schema.sql).
// checklist (task_checklist) dan workSessions (work_sessions) ada di tabel sendiri.
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
  delayReason: "delay_reason",
  attachments: "attachments",
  referenceLinks: "reference_links",
  resultLinks: "result_links",
  createdAt: "created_at",
  startedAt: "started_at",
  finishedAt: "finished_at",
  attachmentsDeletedAt: "attachments_deleted_at",
  deletedAt: "deleted_at",
  deletedBy: "deleted_by",
  updatedAt: "updated_at",
};

// row.checklist & row.workSessions di-embed lewat select (lihat SELECT_TASK di supabaseStore.js).
export function fromRow(row) {
  const t = {};
  for (const [field, column] of Object.entries(COLUMNS)) t[field] = row[column];
  t.checklist = arr(row.checklist);
  t.workSessions = arr(row.workSessions);
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

// ─── Aturan pindah kolom (padanan trigger tasks_before_update di SQL) ──
// Dipakai mode uji coba; di mode Supabase database yang menjalankannya.
export function applyTransition(current, changes, now = new Date().toISOString()) {
  const next = { ...current, ...changes };
  if (next.status !== current.status) {
    if (next.status === "request") next.pic = null;
    if (next.status === "on_progress" && !next.startedAt) next.startedAt = now;
    if (next.status === "finish") next.finishedAt = now;
    else if (current.status === "finish") next.finishedAt = null;
    // Sesi waktu kerja: buka saat masuk On Progress, tutup saat keluar.
    if (next.status === "on_progress") next.workSessions = [...current.workSessions, { startedAt: now, endedAt: null }];
    else if (current.status === "on_progress") next.workSessions = current.workSessions.map((w) => (w.endedAt ? w : { ...w, endedAt: now }));
  }
  if (next.status !== "delay") next.delayReason = null;
  if (next.status !== "request" && !next.pic) throw new Error("Pilih PIC dulu sebelum memindah task dari Request.");
  if (next.status === "finish" && !arr(next.resultLinks).length) throw new Error("Isi minimal satu link hasil desain.");
  return next;
}

// ─── Riwayat (padanan task_changes / task_action di SQL) ────────

const HISTORY_FIELDS = [
  ["title", (t) => t.title],
  ["category", (t) => t.category],
  ["division", (t) => t.division],
  ["requester_name", (t) => t.requesterName],
  ["description", (t) => t.description],
  ["due_date", (t) => t.dueDate || null],
  ["status", (t) => t.status],
  ["pic", (t) => t.pic || null],
  ["delay_reason", (t) => t.delayReason || null],
  ["attachments", (t) => arr(t.attachments).map((a) => a.name)],
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

export function historyAction(oldStatus, newStatus) {
  if (oldStatus === newStatus) return "diubah";
  if (oldStatus === "request" && newStatus === "on_progress") return "diambil";
  if (oldStatus === "finish") return "revisi";
  if (newStatus === "delay") return "ditunda";
  if (oldStatus === "delay" && newStatus === "on_progress") return "dilanjutkan";
  if (newStatus === "finish") return "selesai";
  if (newStatus === "request") return "dilepas";
  return "dipindah";
}

// ─── Turunan untuk tampilan ─────────────────────────────────────

// Desainer selain PIC yang punya item checklist di task ini.
export const helpers = (t) => [...new Set(t.checklist.map((c) => c.assignee).filter((a) => a && a !== t.pic))];

// Task dihitung untuk seorang desainer bila ia PIC, atau punya item checklist yang belum selesai.
export const involves = (t, name) => t.pic === name || t.checklist.some((c) => c.assignee === name && !c.done);
