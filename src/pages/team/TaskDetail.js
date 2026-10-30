// Detail task: pop-up mengambang di tengah (desktop maks 760px, HP layar penuh).
// Kanan atas: Edit (hijau), Hapus (merah, dengan konfirmasi), Tutup (abu-abu).
// Isi: info, brief, lampiran & link, checklist per orang, link hasil, riwayat. Bawah: Pindah ke… + aksi utama.

import React, { useEffect, useState } from "react";
import { ArrowLeftRight, Check, Pencil, Play, RotateCcw, Trash2, X } from "lucide-react";
import { CATEGORIES, DIVISIONS, STATUS } from "../../config";
import * as actions from "../../data/taskActions";
import { helpers } from "../../data/taskModel";
import { describeEntry } from "../../lib/changes";
import { daysLate, fmtDateTime, fmtDay, isOverdue } from "../../lib/dates";
import { newId } from "../../lib/images";
import { displayUrl, normalizeUrl } from "../../lib/links";
import { fmtDuration, isTimerRunning, taskWorkMinutes } from "../../lib/worktime";
import { AttachmentList, Avatar, LinkList, Modal, StatusBadge } from "../../components/ui";

function LinksEditor({ links, onChange, label }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const add = () => {
    const url = normalizeUrl(value);
    if (!url) return setError("Link tidak valid.");
    onChange([...links, { id: newId(), url }]);
    setValue("");
    setError("");
  };
  return (
    <div className="stack">
      {links.map((l) => (
        <div key={l.id} className="link-row link-row-added">
          <span className="url">{displayUrl(l.url)}</span>
          <button type="button" className="icon-btn icon-btn-plain" style={{ color: "var(--rose-600)" }} aria-label={`Hapus ${displayUrl(l.url)}`} onClick={() => onChange(links.filter((x) => x.id !== l.id))}>
            <X size={16} />
          </button>
        </div>
      ))}
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <input type="text" inputMode="url" className={`input grow ${error ? "input-invalid" : ""}`} placeholder="Tempel link" aria-label={label} value={value}
          onChange={(e) => { setValue(e.target.value); setError(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button type="button" className="btn btn-neutral" onClick={add}>Tambah</button>
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

function EditForm({ task, run, busy, onDone }) {
  const [f, setF] = useState({
    title: task.title, category: task.category, division: task.division,
    requesterName: task.requesterName, dueDate: task.dueDate, description: task.description,
  });
  const [refs, setRefs] = useState(task.referenceLinks);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    if (await run(() => actions.editTask(task.id, { ...f, title: f.title.trim(), referenceLinks: refs }), "Perubahan disimpan.")) onDone();
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
          <select id="e-cat" className="select" value={f.category} onChange={set("category")}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        </div>
        <div className="field">
          <label className="label" htmlFor="e-due">Deadline</label>
          <input id="e-due" type="date" className="input" required value={f.dueDate} onChange={set("dueDate")} />
        </div>
        <div className="field">
          <label className="label" htmlFor="e-name">Requester</label>
          <input id="e-name" className="input" value={f.requesterName} onChange={set("requesterName")} />
        </div>
        <div className="field">
          <label className="label" htmlFor="e-div">Divisi</label>
          <select id="e-div" className="select" value={f.division} onChange={set("division")}>{DIVISIONS.map((d) => <option key={d}>{d}</option>)}</select>
        </div>
      </div>
      <div className="field">
        <label className="label" htmlFor="e-desc">Brief</label>
        <textarea id="e-desc" className="textarea" rows={5} value={f.description} onChange={set("description")} />
      </div>
      <div className="field">
        <p className="label">Link referensi</p>
        <LinksEditor links={refs} onChange={setRefs} label="Link referensi baru" />
      </div>
      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={busy}>Simpan</button>
        <button type="button" className="btn btn-neutral" onClick={onDone}>Batal</button>
      </div>
    </form>
  );
}

function Checklist({ task, designers, colorOf, run }) {
  const [text, setText] = useState("");
  const [assignee, setAssignee] = useState(task.pic || designers[0]?.name || "");
  const done = task.checklist.filter((c) => c.done).length;
  const people = designers
    .map((d) => {
      const mine = task.checklist.filter((c) => c.assignee === d.name);
      return { ...d, total: mine.length, done: mine.filter((c) => c.done).length };
    })
    .filter((p) => p.total > 0);
  const add = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    if (await run(() => actions.addChecklistItem(task.id, text.trim(), assignee))) setText("");
  };
  return (
    <section className="stack">
      <div className="row" style={{ gap: 12 }}>
        <h3 className="eyebrow">Checklist{task.checklist.length ? ` (${done} dari ${task.checklist.length})` : ""}</h3>
        {people.map((p) => (
          <span key={p.email} className="row small" style={{ gap: 4 }}><Avatar name={p.name} color={p.color} size={18} />{p.name} {p.done}/{p.total}</span>
        ))}
      </div>
      {task.checklist.map((c) => (
        <div key={c.id} className={`check-item ${c.done ? "done" : ""}`}>
          <input type="checkbox" className="checkbox" id={`chk-${c.id}`} checked={c.done}
            onChange={(e) => run(() => actions.updateChecklistItem(task.id, c.id, { done: e.target.checked }))} />
          <label className="text" htmlFor={`chk-${c.id}`}>{c.text}</label>
          <select aria-label={`Dikerjakan oleh (${c.text})`} value={c.assignee || ""} style={{ color: colorOf(c.assignee) }}
            onChange={(e) => run(() => actions.updateChecklistItem(task.id, c.id, { assignee: e.target.value }))}>
            {designers.map((d) => <option key={d.email} value={d.name}>{d.name}</option>)}
          </select>
          <button type="button" className="icon-btn icon-btn-plain" aria-label={`Hapus "${c.text}"`} onClick={() => run(() => actions.removeChecklistItem(task.id, c.id))}>
            <X size={16} />
          </button>
        </div>
      ))}
      <form className="row" style={{ flexWrap: "nowrap" }} onSubmit={add}>
        <input className="input grow" placeholder="Tambah item checklist" aria-label="Item checklist baru" value={text} onChange={(e) => setText(e.target.value)} style={{ background: "var(--brand-surface)" }} />
        <select className="select" style={{ width: "auto" }} aria-label="Dikerjakan oleh" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          {designers.map((d) => <option key={d.email} value={d.name}>{d.name}</option>)}
        </select>
        <button type="submit" className="btn btn-neutral">Tambah</button>
      </form>
    </section>
  );
}

function History({ task }) {
  const [entries, setEntries] = useState(null);
  useEffect(() => {
    let alive = true;
    actions.listHistory(task.id).then((list) => alive && setEntries(list)).catch(() => alive && setEntries([]));
    return () => {
      alive = false;
    };
  }, [task.id, task.updatedAt, task.checklist]);
  return (
    <section className="stack">
      <h3 className="eyebrow">Riwayat</h3>
      {entries === null && <p className="muted">Memuat…</p>}
      {entries?.length === 0 && <p className="muted">Belum ada riwayat.</p>}
      <ul className="history" style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {(entries || []).map((h) => {
          const d = describeEntry(h);
          return (
            <li key={h.id}>
              <span className="when">{fmtDateTime(h.createdAt)}</span>
              <span className="grow"><strong>{d.who}</strong> {d.what}{d.details && <span className="muted"> · {d.details}</span>}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function TaskDetail({ task, now, designers, colorOf, run, busy, onClose, onTake, onMove }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingResults, setEditingResults] = useState(false);

  useEffect(() => {
    setEditing(false);
    setConfirmDelete(false);
    setEditingResults(false);
  }, [task.id]);

  const late = isOverdue(task);
  const minutes = taskWorkMinutes(task, now);
  const running = isTimerRunning(task);
  const others = helpers(task);
  const move = (status, message) => run(() => actions.moveTask(task.id, status), message);

  return (
    <>
      <Modal labelledBy="detail-title" onClose={() => !confirmDelete && onClose()} className="detail">
        <div className="detail-head">
          <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
            <StatusBadge status={task.status} />
            {late && <span className="badge badge-late">Terlambat {daysLate(task)} hari</span>}
            <span className={`tag ${late ? "tag-due late" : "tag-due"}`} style={{ marginLeft: 0 }}>Deadline {fmtDay(task.dueDate)}</span>
            <div className="detail-icons">
              <button type="button" className="icon-btn icon-btn-edit" aria-label="Edit task" title="Edit" disabled={editing} onClick={() => setEditing(true)}><Pencil size={17} /></button>
              <button type="button" className="icon-btn icon-btn-delete" aria-label="Hapus task" title="Hapus" onClick={() => setConfirmDelete(true)}><Trash2 size={17} /></button>
              <button type="button" className="icon-btn icon-btn-close" aria-label="Tutup" title="Tutup" onClick={onClose}><X size={18} /></button>
            </div>
          </div>
          <h2 id="detail-title" style={{ fontSize: 18, fontWeight: 700 }}>{task.title}</h2>
          <p className="muted">{task.category} · {task.requesterName} ({task.division}) · masuk {fmtDateTime(task.createdAt)}</p>
        </div>

        <div className="detail-body">
          {editing ? (
            <EditForm task={task} run={run} busy={busy} onDone={() => setEditing(false)} />
          ) : (
            <>
              <dl className="info-grid">
                <div>
                  <dt>PIC</dt>
                  <dd>
                    {task.pic ? (
                      <>
                        <Avatar name={task.pic} color={colorOf(task.pic)} size={22} />
                        <select className="select" style={{ minHeight: 28, padding: "0 4px", fontWeight: 700, border: 0, background: "transparent", width: "auto" }} aria-label="Ganti PIC" value={task.pic}
                          onChange={(e) => run(() => actions.changePic(task.id, e.target.value), `PIC diganti ke ${e.target.value}.`)}>
                          {designers.map((d) => <option key={d.email} value={d.name}>{d.name}</option>)}
                          {!designers.some((d) => d.name === task.pic) && <option value={task.pic}>{task.pic}</option>}
                        </select>
                      </>
                    ) : "Belum ada"}
                  </dd>
                </div>
                <div>
                  <dt>Dikerjakan bersama</dt>
                  <dd>{others.length ? others.map((n) => <span key={n} className="row" style={{ gap: 4 }}><Avatar name={n} color={colorOf(n)} size={22} />{n}</span>) : "-"}</dd>
                </div>
                <div>
                  <dt>Waktu kerja</dt>
                  <dd style={{ color: running ? "var(--brand-primary)" : undefined }}>
                    {fmtDuration(minutes)}{running && <span className="small muted" style={{ fontWeight: 600 }}>· berjalan</span>}
                  </dd>
                </div>
                <div>
                  <dt>{task.status === "finish" ? "Selesai" : "Mulai dikerjakan"}</dt>
                  <dd>{fmtDateTime(task.status === "finish" ? task.finishedAt : task.startedAt)}</dd>
                </div>
              </dl>
              <p className="hint" style={{ marginTop: -10 }}>Waktu kerja dihitung Senin–Jumat 08.00–17.00 selama task di On Progress; berhenti di Delay dan Finish.</p>
              {task.status === "delay" && task.delayReason && <p className="delay-note">Ditunda: {task.delayReason}</p>}
              <section className="stack">
                <h3 className="eyebrow">Brief</h3>
                <p style={{ color: "var(--zinc-700)", whiteSpace: "pre-line" }}>{task.description || "Tidak ada brief."}</p>
              </section>
            </>
          )}

          <section className="stack">
            <h3 className="eyebrow">Lampiran ({task.attachments.length} dari 5)</h3>
            <AttachmentList task={task} />
            {!editing && <LinkList links={task.referenceLinks} />}
          </section>

          <Checklist key={task.id} task={task} designers={designers} colorOf={colorOf} run={run} />

          <section className="stack">
            <div className="row-between">
              <h3 className="eyebrow">Link hasil desain</h3>
              {task.status === "finish" && !editingResults && <button type="button" className="btn btn-text btn-sm" onClick={() => setEditingResults(true)}>Ubah</button>}
            </div>
            {editingResults ? (
              <>
                <LinksEditor links={task.resultLinks} label="Link hasil baru"
                  onChange={(links) => links.length ? run(() => actions.setResultLinks(task.id, links)) : run(() => Promise.reject(new Error("Task Finish wajib punya minimal satu link hasil.")))} />
                <button type="button" className="btn btn-neutral" style={{ alignSelf: "flex-start" }} onClick={() => setEditingResults(false)}>Selesai mengubah</button>
              </>
            ) : (
              <LinkList links={task.resultLinks} emptyText="Belum ada. Link hasil diminta saat task dipindah ke Finish." />
            )}
          </section>

          <History task={task} />
        </div>

        <div className="detail-foot">
          {task.status === "request" ? (
            <div className="grid-2 keep primary" style={{ gap: 8 }}>
              {designers.map((d) => (
                <button key={d.email} type="button" className="btn btn-lg btn-outline" style={{ borderColor: d.color, color: d.color }} disabled={busy} onClick={() => onTake(task, d.name)}>
                  Ambil: {d.name}
                </button>
              ))}
            </div>
          ) : (
            <>
              <button type="button" className="btn btn-secondary btn-lg move" onClick={() => onMove(task)}>
                <ArrowLeftRight size={16} aria-hidden="true" /> Pindah ke…
              </button>
              {task.status === "on_progress" && (
                <button type="button" className="btn btn-primary btn-cta primary" disabled={busy} onClick={() => onMove(task, "finish")}>
                  <Check size={18} aria-hidden="true" /> Selesai, kirim link hasil
                </button>
              )}
              {task.status === "delay" && (
                <button type="button" className="btn btn-primary btn-cta primary" disabled={busy} onClick={() => move("on_progress", "Dilanjutkan. Waktu kerja berjalan lagi.")}>
                  <Play size={18} aria-hidden="true" /> Lanjutkan ({STATUS.on_progress.label})
                </button>
              )}
              {task.status === "finish" && (
                <button type="button" className="btn btn-primary btn-cta primary" disabled={busy} onClick={() => move("on_progress", "Revisi dibuka. Task kembali ke On Progress.")}>
                  <RotateCcw size={18} aria-hidden="true" /> Revisi: kembali ke On Progress
                </button>
              )}
            </>
          )}
        </div>
      </Modal>

      {confirmDelete && (
        <Modal labelledBy="delete-title" onClose={() => setConfirmDelete(false)}>
          <h2 id="delete-title" className="h-section">Hapus task ini?</h2>
          <p>"{task.title}" akan hilang dari board. Data dan riwayatnya tetap tersimpan, dan admin bisa memulihkannya.</p>
          <div className="modal-actions">
            <button type="button" className="btn btn-neutral" onClick={() => setConfirmDelete(false)}>Batal</button>
            <button type="button" className="btn btn-danger" disabled={busy}
              onClick={async () => {
                if (await run(() => actions.deleteTask(task.id), "Task dihapus (diarsipkan).")) onClose();
              }}>
              <Trash2 size={16} aria-hidden="true" /> Ya, hapus
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
