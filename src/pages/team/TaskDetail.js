// Panel detail task: panel kanan di desktop, layar penuh di HP.

import React, { useEffect, useState } from "react";
import { ArrowRight, Check, ExternalLink, History, Pencil, RotateCcw, Trash2, X } from "lucide-react";
import { CATEGORIES, DESIGNERS, DIVISIONS } from "../../config";
import * as actions from "../../data/taskActions";
import { isUpdatedByRequester } from "../../data/taskModel";
import { describeChange } from "../../lib/changes";
import { daysLate, dueSoonLabel, fmtDate, fmtDateTime, fmtDay, isDueSoon, isOverdue } from "../../lib/dates";
import { displayUrl, normalizeUrl } from "../../lib/links";
import { newId } from "../../lib/images";
import { Avatar, Modal, ReferenceList, StatusBadge, Stepper, referenceSummary } from "../../components/ui";

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

// Edit dari requester (riwayat "diedit"), terbaru di atas.
function RequesterChanges({ task }) {
  const [entries, setEntries] = useState([]);
  useEffect(() => {
    let alive = true;
    actions
      .listHistory(task.id)
      .then((list) => alive && setEntries(list.filter((h) => h.actor === "requester" && h.action === "diedit")))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [task.id, task.requesterUpdatedAt]);
  if (!entries.length) return null;
  return (
    <section className="stack requester-changes">
      <h3 className="eyebrow row" style={{ gap: 6 }}><History size={14} aria-hidden="true" /> Perubahan dari requester</h3>
      {entries.map((h) => (
        <div key={h.id} className="history-entry stack" style={{ gap: 4 }}>
          <p className="small" style={{ fontWeight: 600 }}>{fmtDateTime(h.createdAt)} <span className="muted" style={{ fontWeight: 400 }}>· oleh {task.requesterName || "requester"}</span></p>
          <ul className="change-list">
            {h.changes.map((c) => {
              const { label, text } = describeChange(c);
              return <li key={c.field}><span className="change-label">{label}</span><span>{text}</span></li>;
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}

function Checklist({ task, run }) {
  const [text, setText] = useState("");
  const [assignee, setAssignee] = useState(task.pic || DESIGNERS[0].name);
  const done = task.checklist.filter((c) => c.done).length;
  // Progres per desainer, ditampilkan bila checklist dibagi ke lebih dari satu orang.
  const people = DESIGNERS.map((d) => {
    const mine = task.checklist.filter((c) => c.assignee === d.name);
    return { name: d.name, total: mine.length, done: mine.filter((c) => c.done).length };
  }).filter((p) => p.total > 0);
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
      {people.length > 1 && (
        <p className="row small" style={{ gap: 12 }}>
          {people.map((p) => (
            <span key={p.name} className="row" style={{ gap: 6 }}>
              <Avatar name={p.name} size={20} /> {p.name} {p.done}/{p.total}
            </span>
          ))}
        </p>
      )}
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
          <select aria-label={`Dikerjakan oleh (${c.text})`} value={c.assignee || ""} onChange={(e) => run(() => actions.updateChecklistItem(task.id, c.id, { assignee: e.target.value }))}>
            {DESIGNERS.map((d) => <option key={d.name}>{d.name}</option>)}
          </select>
          <button type="button" className="icon-btn icon-btn-plain" aria-label={`Hapus "${c.text}"`} onClick={() => run(() => actions.removeChecklistItem(task.id, c.id))}>
            <X size={16} />
          </button>
        </div>
      ))}
      <form className="row" style={{ flexWrap: "nowrap" }} onSubmit={add}>
        <input className="input grow" placeholder="Tambah item checklist" aria-label="Item checklist baru" value={text} onChange={(e) => setText(e.target.value)} style={{ background: "var(--brand-surface)" }} />
        <select className="select" style={{ width: "auto" }} aria-label="Dikerjakan oleh" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          {DESIGNERS.map((d) => <option key={d.name}>{d.name}</option>)}
        </select>
        <button type="submit" className="btn btn-neutral">Tambah</button>
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
        <button type="submit" className="btn btn-neutral">Tambah</button>
      </form>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

export default function TaskDetail({ task, run, busy, onClose, onFinish }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [changingPic, setChangingPic] = useState(false);

  useEffect(() => {
    setEditing(false);
    setConfirmDelete(false);
    setChangingPic(false);
  }, [task.id]);

  // Membuka detail = tim sudah melihat perubahan dari requester; badge di kartu hilang.
  useEffect(() => {
    if (isUpdatedByRequester(task)) actions.markSeen(task.id).catch(() => {});
  }, [task]);

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
          <h2 id="detail-title" className="h-section">{task.title}</h2>
          <p className="small muted">{task.category} · dikirim {fmtDate(task.createdAt)}</p>
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
                    {task.pic && <Avatar name={task.pic} size={20} />}
                    {changingPic && task.status !== "request" ? (
                      <select
                        className="select"
                        style={{ minHeight: 30, padding: "0 6px", fontWeight: 600 }}
                        aria-label="Ganti PIC"
                        autoFocus
                        value={task.pic || ""}
                        onBlur={() => setChangingPic(false)}
                        onChange={async (e) => {
                          const v = e.target.value;
                          setChangingPic(false);
                          if (v === "__release") await run(() => actions.backToRequest(task.id), "PIC dilepas, task kembali ke Request.");
                          else await run(() => actions.changePic(task.id, v), `PIC diganti ke ${v}.`);
                        }}
                      >
                        {DESIGNERS.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
                        <option value="__release">Lepas PIC (kembali ke Request)</option>
                      </select>
                    ) : (
                      <>
                        <span className="grow">{task.pic || "Belum ada"}</span>
                        {task.status !== "request" && (
                          <button type="button" className="btn btn-text btn-sm" style={{ minHeight: 24, padding: "0 4px" }} onClick={() => setChangingPic(true)}>Ganti</button>
                        )}
                      </>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{task.status === "finish" ? "Selesai" : "Mulai dikerjakan"}</dt>
                  <dd>{fmtDate(task.status === "finish" ? task.finishedAt : task.startedAt)}</dd>
                </div>
              </dl>
              <section className="stack">
                <h3 className="eyebrow">Brief</h3>
                <p style={{ color: "var(--zinc-700)", whiteSpace: "pre-line" }}>{task.description || "Tidak ada brief."}</p>
              </section>
            </>
          )}

          <RequesterChanges task={task} />

          <section className="stack">
            <div className="row-between">
              <h3 className="eyebrow">Referensi dari requester</h3>
              {task.status === "finish" && task.referenceImages.length > 0 ? (
                <button type="button" className="btn btn-danger-text btn-sm" onClick={() => run(() => actions.deleteReferenceImages(task.id), "Gambar referensi dihapus.")}>
                  <Trash2 size={14} aria-hidden="true" /> Hapus gambar
                </button>
              ) : (
                <span className="small muted">{referenceSummary(task)}</span>
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
          {task.status === "request" && (
            <div className="grid-2 keep" style={{ width: "100%", gap: 8 }}>
              {DESIGNERS.map((d, i) => (
                <button key={d.name} type="button" className={`btn btn-lg ${i % 2 ? "btn-outline-soil" : "btn-outline"}`} disabled={busy} onClick={() => run(() => actions.assignTask(task.id, d.name), `Diambil ${d.name}.`)}>
                  Ambil: {d.name}
                </button>
              ))}
            </div>
          )}
          {task.status === "todo" && (
            <button type="button" className="btn btn-primary btn-cta btn-block" disabled={busy} onClick={() => run(() => actions.startTask(task.id))}>
              <ArrowRight size={18} aria-hidden="true" /> Mulai kerjakan
            </button>
          )}
          {task.status === "on_progress" && (
            <button type="button" className="btn btn-primary btn-cta btn-block" disabled={busy} onClick={() => onFinish(task)}>
              <Check size={18} aria-hidden="true" /> Selesai, kirim link hasil
            </button>
          )}
          {task.status === "finish" && (
            <button type="button" className="btn btn-primary btn-cta btn-block" disabled={busy} onClick={() => run(() => actions.reviseTask(task.id), "Task kembali ke On Progress untuk revisi.")}>
              <RotateCcw size={18} aria-hidden="true" /> Revisi: kembali ke On Progress
            </button>
          )}
          <div className="row" style={{ width: "100%", justifyContent: "space-between" }}>
            <button type="button" className="btn btn-secondary" disabled={editing} onClick={() => setEditing(true)}>
              <Pencil size={16} aria-hidden="true" /> Edit
            </button>
            <button type="button" className="btn btn-danger-text" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={16} aria-hidden="true" /> Hapus task
            </button>
          </div>
        </div>
      </aside>

      {confirmDelete && (
        <Modal labelledBy="delete-title" onClose={() => setConfirmDelete(false)}>
          <h2 id="delete-title" className="h-section">Hapus task ini?</h2>
          <p>"{task.title}" akan dihapus permanen, termasuk referensi, checklist, dan riwayatnya. Requester juga tidak akan melihatnya lagi di halaman status.</p>
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

