// Kartu task di Kanban. Anatomi (lihat CLAUDE.md, "Aturan tata letak UI"):
// badge + kategori, deadline di kanan → judul → requester · divisi → lampiran mini → PIC + bersama + waktu kerja
// → progres checklist → aksi (Request: tombol desainer; lainnya: "Pindah ke…").
// Klik kartu membuka pop-up detail; di desktop kartu bisa digeser ke kolom lain.

import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeftRight, Clock, ExternalLink, Timer } from "lucide-react";
import { helpers } from "../../data/taskModel";
import { daysLate, fmtDayShort, fmtShort, isOverdue } from "../../lib/dates";
import { displayUrl } from "../../lib/links";
import { fmtDuration, isTimerRunning, taskWorkMinutes } from "../../lib/worktime";
import { AttachmentStrip, Avatar } from "../../components/ui";

export default function TaskCard({ task: t, now, designers, colorOf, busy, draggable, onTake, onMove, onDragStart, onDragEnd, dragging }) {
  const navigate = useNavigate();
  const late = isOverdue(t);
  const done = t.checklist.filter((c) => c.done).length;
  const others = helpers(t);
  const minutes = taskWorkMinutes(t, now);
  const running = isTimerRunning(t);
  const open = () => navigate(`/tim/task/${t.id}`);
  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn();
  };

  return (
    <article
      className={`task-card ${dragging ? "dragging" : ""}`}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", t.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.(t);
      }}
      onDragEnd={() => onDragEnd?.()}
      onClick={open}
    >
      <div className="card-top">
        {late && <span className="badge badge-late">Terlambat {daysLate(t)} hari</span>}
        <span className="tag tag-category">{t.category}</span>
        <span className={`tag tag-due ${late ? "late" : ""}`}>
          <Clock size={11} aria-hidden="true" />
          {t.status === "finish" ? `Selesai ${fmtShort(t.finishedAt)}` : fmtDayShort(t.dueDate)}
        </span>
      </div>
      <a href={`/tim/task/${t.id}`} className="task-title" onClick={(e) => { e.preventDefault(); e.stopPropagation(); open(); }}>{t.title}</a>
      <span className="task-sub">{t.requesterName} · {t.division}</span>
      <AttachmentStrip attachments={t.attachments} />
      {t.attachmentsDeletedAt && !t.attachments.length && <span className="small muted">Lampiran dihapus otomatis</span>}
      {(t.pic || minutes > 0) && (
        <div className="task-meta">
          {t.pic && <span className="pic"><Avatar name={t.pic} color={colorOf(t.pic)} size={20} />{t.pic}</span>}
          {others.length > 0 && <span>· bersama {others.join(", ")}</span>}
          {(minutes > 0 || running) && (
            <span className={`time ${running ? "running" : ""}`} title={running ? "Waktu kerja berjalan" : "Waktu kerja (jam kerja)"}>
              <Timer size={13} aria-hidden="true" />{fmtDuration(minutes)}
            </span>
          )}
        </div>
      )}
      {t.checklist.length > 0 && t.status !== "request" && (
        <div>
          <div className="progress" aria-hidden="true"><div style={{ width: `${Math.round((done / t.checklist.length) * 100)}%` }} /></div>
          <p className="small muted" style={{ marginTop: 4 }}>Checklist {done}/{t.checklist.length}</p>
        </div>
      )}
      {t.status === "delay" && t.delayReason && <p className="delay-note">Ditunda: {t.delayReason}</p>}
      {t.status === "finish" &&
        t.resultLinks.map((l) => (
          <a key={l.id} className="result-link" href={l.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
            <ExternalLink size={14} aria-hidden="true" />
            <span>{t.resultLinks.length > 1 ? displayUrl(l.url) : "Link hasil desain"}</span>
          </a>
        ))}
      <div className="card-actions">
        {t.status === "request" ? (
          <div className="grid-2 keep">
            {designers.map((d, i) => (
              <button key={d.email} type="button" className={`btn ${i % 2 ? "btn-outline" : "btn-outline-soil"}`} style={{ borderColor: d.color, color: d.color }} disabled={busy} onClick={stop(() => onTake(t, d.name))}>
                {d.name}
              </button>
            ))}
          </div>
        ) : (
          <button type="button" className="btn btn-text btn-block" onClick={stop(() => onMove(t))}>
            <ArrowLeftRight size={16} aria-hidden="true" /> Pindah ke…
          </button>
        )}
      </div>
    </article>
  );
}
