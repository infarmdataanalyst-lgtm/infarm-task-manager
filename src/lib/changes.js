// Teks yang bisa dibaca manusia untuk satu perubahan riwayat: {field, before, after}
// (bentuk dari taskChanges() di taskModel.js / task_changes() di supabase/schema.sql).

import { STATUS } from "../config";
import { fmtDay } from "./dates";
import { displayUrl } from "./links";

export const FIELD_LABEL = {
  title: "Judul",
  category: "Kategori",
  division: "Divisi",
  requester_name: "Nama",
  description: "Brief",
  due_date: "Deadline",
  status: "Status",
  pic: "PIC",
  reference_images: "Gambar",
  reference_links: "Link referensi",
  result_links: "Link hasil",
};

export const ACTION_LABEL = {
  dibuat: "Request dikirim",
  diedit: "Diedit requester",
  diambil: "Diambil",
  dimulai: "Mulai dikerjakan",
  selesai: "Selesai",
  revisi: "Revisi",
  dilepas: "PIC dilepas",
  dikembalikan: "Dikembalikan ke Todo",
  diubah: "Diubah tim",
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
  if (field === "reference_images") text = listDiff(before, after, String);
  else if (field === "reference_links" || field === "result_links") text = listDiff(before, after, displayUrl);
  else if (field === "description") text = after ? "diperbarui" : "dikosongkan";
  else if (field === "due_date") text = `${fmtDay(before)} → ${fmtDay(after)}`;
  else if (field === "status") text = `${STATUS[before]?.label || scalar(before)} → ${STATUS[after]?.label || scalar(after)}`;
  else text = `${scalar(before)} → ${scalar(after)}`;
  return { label, text };
}
