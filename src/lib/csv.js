import { STATUS } from "../config";
import { fmtDay, fmtDateTime } from "./dates";

// Escape sesuai RFC 4180: bungkus dengan kutip, kutip di dalam nilai digandakan.
const cell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export function tasksToCsv(tasks) {
  const header = [
    "Judul", "Kategori", "Status", "PIC", "Deadline", "Divisi", "Nama Requester",
    "Dikirim", "Selesai", "Checklist", "Gambar Referensi", "Link Referensi", "Link Hasil",
  ];
  const rows = tasks.map((t) => [
    t.title,
    t.category,
    STATUS[t.status]?.label,
    t.pic || "-",
    fmtDay(t.dueDate),
    t.division,
    t.requesterName,
    fmtDateTime(t.createdAt),
    fmtDateTime(t.finishedAt),
    `${t.checklist.filter((c) => c.done).length}/${t.checklist.length}`,
    t.referenceImages.length,
    t.referenceLinks.map((l) => l.url).join(" "),
    t.resultLinks.map((l) => l.url).join(" "),
  ]);
  // BOM supaya Excel membaca UTF-8 dengan benar.
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

export function downloadCsv(tasks, filename = "infarm-request-desain.csv") {
  const blob = new Blob([tasksToCsv(tasks)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
