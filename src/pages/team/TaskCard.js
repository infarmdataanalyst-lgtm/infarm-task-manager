// Kartu task di Kanban. Tombol aksi mengikuti tahapan alur kerja.

import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, Check, ExternalLink, ImageIcon, RotateCcw } from "lucide-react";
import { DESIGNERS } from "../../config";
import { daysLate, dueSoonLabel, fmtDay, fmtShort, isDueSoon, isOverdue } from "../../lib/dates";
import { displayUrl } from "../../lib/links";
import { Avatar, referenceSummary } from "../../components/ui";

export default function TaskCard({ task: t, busy, onAssign, onStart, onFinish, onRevise }) {
  const late = isOverdue(t);
  const done = t.checklist.filter((c) => c.done).length;

  return (
    <article className={`task-card ${late ? "late" : ""}`}>
      {t.pic && (
        <div className="pic-line">
          <Avatar name={t.pic} />
          <span>PIC: {t.pic}</span>
          <span style={{ marginLeft: "auto" }}>
            {late && <span className="badge badge-late">Terlambat {daysLate(t)} hari</span>}
            {!late && isDueSoon(t) && <span className="badge badge-soon">{dueSoonLabel(t)}</span>}
            {t.status === "finish" && <span className="small muted" style={{ fontWeight: 400 }}>Selesai {fmtShort(t.finishedAt)}</span>}
          </span>
        </div>
      )}
      <Link to={`/tim/task/${t.id}`} className="task-title">{t.title}</Link>
      <p className="small muted">{t.category} · {t.requesterName} ({t.division})</p>
      <div className="task-meta">
        <span style={{ color: late ? "var(--rose-700)" : undefined }}>
          <CalendarDays size={14} aria-hidden="true" /> {fmtDay(t.dueDate)}
        </span>
        {t.status !== "finish" && (
          <span><ImageIcon size={14} aria-hidden="true" /> {referenceSummary(t)}</span>
        )}
        {!t.pic && late && <span className="badge badge-late">Terlambat {daysLate(t)} hari</span>}
        {!t.pic && !late && isDueSoon(t) && <span className="badge badge-soon">{dueSoonLabel(t)}</span>}
      </div>

      {t.status === "on_progress" && t.checklist.length > 0 && (
        <div>
          <div className="progress" aria-hidden="true"><div style={{ width: `${Math.round((done / t.checklist.length) * 100)}%` }} /></div>
          <p className="small muted" style={{ marginTop: 4 }}>Checklist {done}/{t.checklist.length}</p>
        </div>
      )}

      {t.status === "request" && (
        <div className="card-divider">
          <p className="small muted" style={{ fontWeight: 600, marginBottom: 6 }}>Atur PIC</p>
          <div className="grid-2 keep" style={{ gap: 6 }}>
            {DESIGNERS.map((d, i) => (
              <button key={d.name} type="button" className={`btn btn-sm ${i % 2 ? "btn-outline-soil" : "btn-outline"}`} disabled={busy} onClick={() => onAssign(t, d.name)}>
                Ambil: {d.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {t.status === "todo" && (
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => onStart(t)}>
          Mulai kerjakan <ArrowRight size={16} aria-hidden="true" />
        </button>
      )}
      {t.status === "on_progress" && (
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => onFinish(t)}>
          <Check size={16} aria-hidden="true" /> Selesai, kirim link hasil
        </button>
      )}
      {t.status === "finish" && (
        <>
          {t.resultLinks.map((l) => (
            <a key={l.id} className="result-link" href={l.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={14} aria-hidden="true" />
              <span>{displayUrl(l.url)}</span>
            </a>
          ))}
          <p className="small muted">
            {t.referenceImages.length
              ? `${t.referenceImages.length} gambar referensi bisa dihapus`
              : t.referenceImagesDeletedAt
                ? "Gambar referensi sudah dihapus"
                : "Tidak ada gambar referensi"}
          </p>
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => onRevise(t)}>
            <RotateCcw size={16} aria-hidden="true" /> Revisi: kembali ke On Progress
          </button>
        </>
      )}
    </article>
  );
}
