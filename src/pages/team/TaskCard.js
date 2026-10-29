// Kartu task di Kanban. Anatomi sama dengan kartu di halaman status (lihat CLAUDE.md, "Aturan tata letak UI"):
// badge status + urgensi & deadline → judul → kategori · requester → PIC + referensi → progres → tombol aksi.

import React from "react";
import { Link } from "react-router-dom";
import { ExternalLink, ImageIcon } from "lucide-react";
import { DESIGNERS } from "../../config";
import { daysLate, dueSoonLabel, fmtDayShort, fmtShort, isDueSoon, isOverdue } from "../../lib/dates";
import { displayUrl } from "../../lib/links";
import { Avatar, StatusBadge, referenceSummary } from "../../components/ui";

export default function TaskCard({ task: t, busy, onAssign, onStart, onFinish, onRevise }) {
  const late = isOverdue(t);
  const done = t.checklist.filter((c) => c.done).length;

  return (
    <article className="task-card">
      <div className="card-top">
        <StatusBadge status={t.status} />
        {late && <span className="badge badge-late">Terlambat {daysLate(t)} hari</span>}
        {!late && isDueSoon(t) && <span className="badge badge-soon">{dueSoonLabel(t)}</span>}
        <span className="card-due" style={{ color: late ? "var(--rose-700)" : undefined }}>
          {t.status === "finish" ? `Selesai ${fmtShort(t.finishedAt)}` : `Deadline ${fmtDayShort(t.dueDate)}`}
        </span>
      </div>
      <Link to={`/tim/task/${t.id}`} className="task-title">{t.title}</Link>
      <p className="small muted">{t.category} · {t.requesterName} ({t.division})</p>
      <div className="task-meta">
        {t.pic && (
          <span style={{ fontWeight: 600 }}>
            <Avatar name={t.pic} size={20} /> PIC: {t.pic}
          </span>
        )}
        <span><ImageIcon size={14} aria-hidden="true" /> {referenceSummary(t)}</span>
      </div>

      {t.status === "on_progress" && t.checklist.length > 0 && (
        <div>
          <div className="progress" aria-hidden="true"><div style={{ width: `${Math.round((done / t.checklist.length) * 100)}%` }} /></div>
          <p className="small muted" style={{ marginTop: 4 }}>Checklist {done}/{t.checklist.length}</p>
        </div>
      )}
      {t.status === "finish" &&
        t.resultLinks.map((l) => (
          <a key={l.id} className="result-link" href={l.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={14} aria-hidden="true" />
            <span>{t.resultLinks.length > 1 ? displayUrl(l.url) : "Link hasil desain"}</span>
          </a>
        ))}

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
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => onStart(t)}>Mulai kerjakan</button>
      )}
      {t.status === "on_progress" && (
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => onFinish(t)}>Selesai, kirim link hasil</button>
      )}
      {t.status === "finish" && (
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => onRevise(t)}>Revisi: kembali ke On Progress</button>
      )}
    </article>
  );
}
