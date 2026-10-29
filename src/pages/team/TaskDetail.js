// Panel detail task: panel kanan di desktop, layar penuh di HP.

import React, { useEffect, useState } from "react";
import { ArrowRight, Check, ExternalLink, Pencil, RotateCcw, Trash2, X } from "lucide-react";
import { CATEGORIES, DESIGNERS, DIVISIONS } from "../../config";
import * as actions from "../../data/taskActions";
import { daysLate, dueSoonLabel, fmtDateTime, fmtDay, isDueSoon, isOverdue } from "../../lib/dates";
import { displayUrl, normalizeUrl } from "../../lib/links";
import { newId } from "../../lib/images";
import { Avatar, Modal, ReferenceList, StatusBadge, Stepper } from "../../components/ui";

function EditForm({ task, run, busy, onDone }) {
  const [f, setF] = useState({
    title: task.title, category: task.category, division: task.division,
    requesterName: task.requesterName, dueDate: task.dueDate, description: task.description,
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    if (await run(() => actions.editTask(task.id, { ...f, title: f.title.trim() }), "Perubahan disimpan.")) onDone();
  };
  return (
    <form className="card card-pad stack-lg" style={{ background: "var(--brand-surface)" }} onSubmit={save}>
      <div className="field">
        <label className="label" htmlFor="e-title">Judul</label>
        <input id="e-title" className="input" required value={f.title} onChange={set("title")} />
      </div>
      <div className="grid-2 keep">
        <div className="field">
          <label className="label" htmlFor="e-cat">Kategori</label>
          <select id="e-cat" className="select" value={f.category} onChange={set("category")}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="e-due">Deadline</label>
          <input id="e-due" type="date" className="input" required value={f.dueDate} onChange={set("dueDate")} />
        </div>
        <div className="field">
          <label className="label" htmlFor="e-name">Nama requester</label>
          <input id="e-name" className="input" value={f.requesterName} onChange={set("requesterName")} />
        </div>
        <div className="field">
          <label className="label" htmlFor="e-div">Divisi</label>
          <select id="e-div" className="select" value={f.division} onChange={set("division")}>
            {DIVISIONS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label className="label" htmlFor="e-desc">Brief</label>
        <textarea id="e-desc" className="textarea" value={f.description} onChange={set("description")} />
      </div>
      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={busy}>Simpan</button>
        <button type="button" className="btn btn-neutral" onClick={onDone}>Batal</button>
      </div>
    </form>
  );
}

function Checklist({ task, run }) {
  const [text, setText] = useState("");
  const [assignee, setAssignee] = useState(task.pic || DESIGNERS[0].name);
  const done = task.checklist.filter((c) => c.done).length;
  const add = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    if (await run(() => actions.addChecklistItem(task.id, text.trim(), assignee))) setText("");
  };
  return (
    <section className="stack">
      <div className="row-between">
        <h3 className="eyebrow">Checklist</h3>
        {task.checklist.length > 0 && <span className="small muted">{done} dari {task.checklist.length} selesai</span>}
      </div>
      {task.checklist.map((c) => (
        <div key={c.id} className={`check-item ${c.done ? "done" : ""}`}>
          <input
            type="checkbox"
            className="checkbox"
            id={`chk-${c.id}`}
            checked={c.done}
            onChange={(e) => run(() => actions.updateChecklistItem(task.id, c.id, { done: e.target.checked }))}
          />
          <label className="text" htmlFor={`chk-${c.id}`}>{c.text}</label>
          <select aria-label={`PIC untuk "${c.text}"`} value={c.assignee || ""} onChange={(e) => run(() => actions.updateChecklistItem(task.id, c.id, { assignee: e.target.value }))}>
            {DESIGNERS.map((d) => <option key={d.name}>{d.name}</option>)}
          </select>
          <button type="button" className="icon-btn icon-btn-plain" aria-label={`Hapus "${c.text}"`} onClick={() => run(() => actions.removeChecklistItem(task.id, c.id))}>
            <X size={16} />
          </button>
        </div>
      ))}
      <form className="row" style={{ flexWrap: "nowrap" }} onSubmit={add}>
        <input className="input grow" placeholder="Tambah item checklist" aria-label="Item checklist baru" value={text} onChange={(e) => setText(e.target.value)} style={{ background: "var(--brand-surface)" }} />
        <select className="select" style={{ width: "auto" }} aria-label="PIC item baru" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          {DESIGNERS.map((d) => <option key={d.name}>{d.name}</option>)}
        </select>
        <button type="submit" className="btn btn-neutral" style={{ minHeight: 44 }}>Tambah</button>
      </form>
    </section>
  );
}

function ResultLinks({ task, run }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  if (task.status !== "finish") {
    return <p className="empty-box">Belum ada. Link hasil diminta saat task dipindah ke Finish.</p>;
  }
  const add = async (e) => {
    e.preventDefault();
    const url = normalizeUrl(value);
    if (!url) return setError("Link tidak valid.");
    if (await run(() => actions.setResultLinks(task.id, [...task.resultLinks, { id: newId(), url }]))) {
      setValue("");
      setError("");
    }
  };
  return (
    <div className="stack">
      {task.resultLinks.map((l) => (
        <div key={l.id} className="link-row link-row-added">
          <a href={l.url} target="_blank" rel="noopener noreferrer" className="url" style={{ fontWeight: 600, textDecoration: "none" }}>
            <ExternalLink size={14} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: 6 }} />
            {displayUrl(l.url)}
          </a>
          {task.resultLinks.length > 1 && (
            <button type="button" className="icon-btn icon-btn-plain" style={{ color: "var(--rose-600)" }} aria-label={`Hapus link ${displayUrl(l.url)}`} onClick={() => run(() => actions.setResultLinks(task.id, task.resultLinks.filter((x) => x.id !== l.id)))}>
              <X size={16} />
            </button>
          )}
        </div>
      ))}
      <form className="row" style={{ flexWrap: "nowrap" }} onSubmit={add}>
        <input type="text" inputMode="url" className={`input grow ${error ? "input-invalid" : ""}`} placeholder="Tambah link hasil lain" aria-label="Link hasil baru" value={value} onChange={(e) => { setValue(e.target.value); setError(""); }} />
        <button type="submit" className="btn btn-neutral" style={{ minHeight: 44 }}>Tambah</button>
      </form>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

export default function TaskDetail({ task, run, busy, onClose, onFinish }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setEditing(false);
    setConfirmDelete(false);
  }, [task.id]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !confirmDelete && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, confirmDelete]);

  const late = isOverdue(task);

  return (
    <>
      <div className="overlay" onClick={onClose} aria-hidden="true" />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <div className="drawer-head">
          <div className="row">
            <StatusBadge status={task.status} />
            {late && <span className="badge badge-late">Terlambat {daysLate(task)} hari</span>}
            {!late && isDueSoon(task) && <span className="badge badge-soon">{dueSoonLabel(task)}</span>}
            <button type="button" className="icon-btn" style={{ marginLeft: "auto" }} aria-label="Tutup detail" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
          <h2 id="detail-title" style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.5 }}>{task.title}</h2>
          <p className="small muted">{task.category} · dikirim {fmtDateTime(task.createdAt)}</p>
          <Stepper status={task.status} />
        </div>

        <div className="drawer-body">
          {editing ? (
            <EditForm task={task} run={run} busy={busy} onDone={() => setEditing(false)} />
          ) : (
            <>
              <dl className="info-grid">
                <div><dt>Requester</dt><dd>{task.requesterName} · {task.division}</dd></div>
                <div><dt>Deadline</dt><dd style={{ color: late ? "var(--rose-700)" : undefined }}>{fmtDay(task.dueDate)}</dd></div>
                <div>
                  <dt>PIC</dt>
                  <dd className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                    {task.pic && <Avatar name={task.pic} size={22} />}
                    {task.status === "request" ? (
                      <span>Belum ada</span>
                    ) : (
                      <select className="select" style={{ minHeight: 32, padding: "0 6px", fontWeight: 600 }} aria-label="Ganti PIC" value={task.pic || ""} onChange={(e) => run(() => actions.changePic(task.id, e.target.value), `PIC diganti ke ${e.target.value}.`)}>
                        {DESIGNERS.map((d) => <option key={d.name}>{d.name}</option>)}
                      </select>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{task.status === "finish" ? "Selesai" : "Mulai dikerjakan"}</dt>
                  <dd>{fmtDateTime(task.status === "finish" ? task.finishedAt : task.startedAt)}</dd>
                </div>
              </dl>
              <section className="stack">
                <h3 className="eyebrow">Brief</h3>
                <p style={{ color: "var(--zinc-700)", whiteSpace: "pre-line" }}>{task.description || "Tidak ada brief."}</p>
              </section>
            </>
          )}

          <section className="stack">
            <div className="row-between">
              <h3 className="eyebrow">Referensi dari requester</h3>
              {task.status === "finish" && task.referenceImages.length > 0 && (
                <button type="button" className="btn btn-danger-text btn-sm" onClick={() => run(() => actions.deleteReferenceImages(task.id), "Gambar referensi dihapus.")}>
                  <Trash2 size={14} aria-hidden="true" /> Hapus gambar
                </button>
              )}
            </div>
            <ReferenceList task={task} />
          </section>

          <Checklist key={task.id} task={task} run={run} />

          <section className="stack">
            <h3 className="eyebrow">Link hasil desain</h3>
            <ResultLinks task={task} run={run} />
          </section>
        </div>

        <div className="drawer-foot">
          {task.status === "request" &&
            DESIGNERS.map((d, i) => (
              <button key={d.name} type="button" className={`btn ${i % 2 ? "btn-outline-soil" : "btn-outline"} grow`} style={{ minHeight: 44 }} disabled={busy} onClick={() => run(() => actions.assignTask(task.id, d.name), `Diambil ${d.name}.`)}>
                Ambil: {d.name}
              </button>
            ))}
          {task.status === "todo" && (
            <>
              <button type="button" className="btn btn-primary btn-cta grow" disabled={busy} onClick={() => run(() => actions.startTask(task.id))}>
                Mulai kerjakan <ArrowRight size={18} aria-hidden="true" />
              </button>
              <button type="button" className="btn btn-text" onClick={() => run(() => actions.backToRequest(task.id), "Dikembalikan ke Request.")}>
                Lepas PIC, kembali ke Request
              </button>
            </>
          )}
          {task.status === "on_progress" && (
            <>
              <button type="button" className="btn btn-primary btn-cta grow" disabled={busy} onClick={() => onFinish(task)}>
                <Check size={18} aria-hidden="true" /> Selesai, kirim link hasil
              </button>
              <button type="button" className="btn btn-text" onClick={() => run(() => actions.backToTodo(task.id))}>Kembali ke Todo</button>
            </>
          )}
          {task.status === "finish" && (
            <button type="button" className="btn btn-secondary grow" style={{ minHeight: 44 }} disabled={busy} onClick={() => run(() => actions.reviseTask(task.id), "Task kembali ke On Progress untuk revisi.")}>
              <RotateCcw size={16} aria-hidden="true" /> Revisi: kembali ke On Progress
            </button>
          )}
          <div className="row" style={{ width: "100%", justifyContent: "space-between" }}>
            {!editing && (
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>
                <Pencil size={16} aria-hidden="true" /> Edit
              </button>
            )}
            <button type="button" className="btn btn-danger-text" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={16} aria-hidden="true" /> Hapus task
            </button>
          </div>
        </div>
      </aside>

      {confirmDelete && (
        <Modal labelledBy="delete-title" onClose={() => setConfirmDelete(false)}>
          <h2 id="delete-title" style={{ fontSize: 18, fontWeight: 600 }}>Hapus task ini?</h2>
          <p>"{task.title}" akan dihapus permanen, termasuk referensi dan checklist-nya. Requester juga tidak akan melihatnya lagi di halaman status.</p>
          <div className="modal-actions">
            <button type="button" className="btn btn-neutral" onClick={() => setConfirmDelete(false)}>Batal</button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={busy}
              onClick={async () => {
                const ok = await run(() => actions.deleteTask(task.id).then(() => true), "Task dihapus.");
                if (ok) onClose();
              }}
            >
              <Trash2 size={16} aria-hidden="true" /> Ya, hapus
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

