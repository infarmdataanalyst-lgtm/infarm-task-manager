// Kartu task di Kanban. Anatomi (lihat CLAUDE.md, "Aturan tata letak UI"):
// badge + kategori, deadline di kanan → judul → requester · divisi → lampiran mini → PIC + bersama + waktu kerja
// → progres checklist → aksi (Request tanpa PIC: tombol desainer = tentukan PIC; Request ber-PIC: "Mulai kerjakan"
// (hanya PIC/admin) + ganti PIC; lainnya: "Pindah ke…"). Task dari arsip lama (hasil cari database) diberi label.
// Klik kartu membuka pop-up detail; di desktop kartu bisa digeser ke kolom lain.

import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeftRight, Clock, ExternalLink, Play, Timer } from "lucide-react";
import { attachmentsDeleteDate, canLeaveRequest, helpers, notPicMessage } from "../../data/taskModel";
import { ATTACHMENT_RETENTION_DAYS } from "../../config";
import { daysLate, fmtDayShort, fmtLongDate, fmtShort, isOverdue } from "../../lib/dates";
import { displayUrl } from "../../lib/links";
import { fmtDuration, isTimerRunning, taskTotalMinutes } from "../../lib/worktime";
import { AttachmentStrip, Avatar } from "../../components/ui";

export default function TaskCard({ task: t, isNew, fromArchive, now, member, designers, colorOf, busy, draggable, onAssign, onStart, onMove, onDragStart, onDragEnd, dragging }) {
  const navigate = useNavigate();
  const late = isOverdue(t);
  const done = t.checklist.filter((c) => c.done).length;
  const others = helpers(t);
  const minutes = taskTotalMinutes(t, now); // total sejak request masuk
  const running = isTimerRunning(t);
  const canStart = canLeaveRequest(t, member);
  const deleteOn = attachmentsDeleteDate(t, ATTACHMENT_RETENTION_DAYS);
  const open = () => navigate(`/tim/task/${t.id}`);
  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn();
  };

  return (
    <article
      className={`task-card ${dragging ? "dragging" : ""} ${isNew ? "is-new" : ""}`}
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
        {isNew && <span className="badge badge-new">Baru</span>}
        {fromArchive && <span className="badge badge-archive">Dari arsip lama</span>}
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
      {deleteOn && <span className="attach-expiry">Lampiran akan dihapus otomatis {fmtLongDate(deleteOn)}</span>}
      <div className="task-meta">
        {t.pic && <span className="pic"><Avatar name={t.pic} color={colorOf(t.pic)} size={20} />{t.pic}</span>}
        {others.length > 0 && <span>· bersama {others.join(", ")}</span>}
        <span className={`time ${running ? "running" : ""}`} title={`Total waktu sejak request masuk (jam kerja)${running ? ", masih berjalan" : ""}`}>
          <Timer size={13} aria-hidden="true" />{fmtDuration(minutes)}
        </span>
      </div>
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
        {t.status === "request" && !t.pic ? (
          <>
            <span className="small muted">Tentukan PIC</span>
            <div className="grid-2 keep">
              {designers.map((d, i) => (
                <button key={d.email} type="button" className={`btn ${i % 2 ? "btn-outline" : "btn-outline-soil"}`} style={{ borderColor: d.color, color: d.color }} disabled={busy} onClick={stop(() => onAssign(t, d.name))}>
                  {d.name}
                </button>
              ))}
            </div>
          </>
        ) : t.status === "request" ? (
          <>
            <button type="button" className="btn btn-primary btn-block" disabled={busy || !canStart} title={canStart ? undefined : notPicMessage(t.pic)} onClick={stop(() => onStart(t))}>
              <Play size={15} aria-hidden="true" /> Mulai kerjakan
            </button>
            {!canStart && <span className="small muted">{notPicMessage(t.pic)}</span>}
            <div className="row" style={{ gap: 6 }}>
              {designers.filter((d) => d.name !== t.pic).map((d) => (
                <button key={d.email} type="button" className="btn btn-text btn-sm" disabled={busy} onClick={stop(() => onAssign(t, d.name))}>Ganti PIC ke {d.name}</button>
              ))}
            </div>
          </>
        ) : (
          <button type="button" className="btn btn-text btn-block" onClick={stop(() => onMove(t))}>
            <ArrowLeftRight size={16} aria-hidden="true" /> Pindah ke…
          </button>
        )}
      </div>
    </article>
  );
}
