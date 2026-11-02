// Teks yang bisa dibaca manusia untuk riwayat: aksi + perubahan {field, before, after}
// (bentuk dari taskChanges() di taskModel.js / task_changes() di supabase/schema.sql).

import { STATUS } from "../config";
import { fmtDay } from "./dates";
import { displayUrl } from "./links";

export const FIELD_LABEL = {
  title: "Judul",
  category: "Kategori",
  division: "Divisi",
  requester_name: "Requester",
  description: "Brief",
  due_date: "Deadline",
  status: "Kolom",
  pic: "PIC",
  delay_reason: "Alasan ditunda",
  attachments: "Lampiran",
  reference_links: "Link referensi",
  result_links: "Link hasil",
  checklist: "Checklist",
};

export const ACTION_LABEL = {
  dibuat: "mengirim request lewat form",
  diambil: "mengambil task",
  dipindah: "memindah task",
  ditunda: "menunda task",
  dilanjutkan: "melanjutkan task",
  selesai: "menyelesaikan task",
  revisi: "membuka revisi",
  dilepas: "mengembalikan ke Request",
  diubah: "mengubah task",
  checklist: "mengubah checklist",
  dihapus: "menghapus task",
  dipulihkan: "memulihkan task",
  lampiran_dihapus: "menghapus lampiran otomatis",
};

const list = (v) => (Array.isArray(v) ? v : []);

function listDiff(before, after, fmt) {
  const added = list(after).filter((x) => !list(before).includes(x));
  const removed = list(before).filter((x) => !list(after).includes(x));
  const parts = [];
  if (removed.length) parts.push(`${removed.map(fmt).join(", ")} dihapus`);
  if (added.length) parts.push(`${added.map(fmt).join(", ")} ditambah`);
  return parts.join("; ") || "urutan diubah";
}

const scalar = (v) => (v === null || v === undefined || v === "" ? "-" : String(v));

export function describeChange({ field, before, after }) {
  const label = FIELD_LABEL[field] || field;
  let text;
  if (field === "attachments") text = listDiff(before, after, String);
  else if (field === "reference_links" || field === "result_links") text = listDiff(before, after, displayUrl);
  else if (field === "description") text = after ? "diperbarui" : "dikosongkan";
  else if (field === "due_date") text = `${fmtDay(before)} → ${fmtDay(after)}`;
  else if (field === "status") text = `${STATUS[before]?.label || scalar(before)} → ${STATUS[after]?.label || scalar(after)}`;
  else if (field === "checklist") text = before && after ? `${before} → ${after}` : after ? `+ ${after}` : `− ${before}`;
  else text = `${scalar(before)} → ${scalar(after)}`;
  return { label, text };
}

// Satu baris riwayat: "Arum mengambil task · Kolom: Request → On Progress; PIC: - → Arum".
export const describeEntry = (h) => ({
  who: h.actorName,
  what: ACTION_LABEL[h.action] || h.action,
  details: h.changes
    .filter((c) => !(h.action !== "diubah" && c.field === "status"))
    .map((c) => {
      const d = describeChange(c);
      return `${d.label}: ${d.text}`;
    })
    .join("; "),
});
