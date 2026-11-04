// Dialog "Pindah ke…": pilih kolom tujuan (maju atau mundur) beserta isian yang dibutuhkan.
// - Dari Request ke kolom lain: hanya PIC atau admin. Admin bisa memilih/mengganti PIC; desainer tanpa PIC
//   otomatis menjadi PIC. Database menolak selain itu ('bukan_pic').
// - Ke Delay: alasan (opsional), tampil di kartu.
// - Ke Finish: link hasil (opsional). Total waktu berhenti.
// Waktu per kolom tercatat otomatis (lihat stageMinutes di lib/worktime.js).
// - Ke Request: PIC tetap; waktu yang sudah tercatat tetap disimpan.

import React, { useState } from "react";
import { Plus, X } from "lucide-react";
import { STATUS, STATUSES } from "../../config";
import { moveTask } from "../../data/taskActions";
import { canLeaveRequest, notPicMessage } from "../../data/taskModel";
import { newId } from "../../lib/images";
import { normalizeUrl } from "../../lib/links";
import { fmtDuration, stageMinutes } from "../../lib/worktime";
import { Modal } from "../../components/ui";

const NOTES = {
  request: "PIC tetap; waktu yang sudah tercatat tetap disimpan",
  on_progress: "Sedang dikerjakan",
  delay: "Ditunda karena menunggu sesuatu",
  finish: "Link hasil opsional; total waktu berhenti",
};

export default function MoveDialog({ task, initialTarget, designers, member, run, busy, onClose, onDone }) {
  const [target, setTarget] = useState(initialTarget && initialTarget !== task.status ? initialTarget : STATUSES.find((s) => s !== task.status));
  const [pic, setPic] = useState(task.pic || "");
  const [reason, setReason] = useState(task.delayReason || "");
  const [links, setLinks] = useState(() =>
    task.resultLinks.length ? task.resultLinks.map((l) => ({ id: l.id, value: l.url })) : [{ id: newId(), value: "" }]
  );
  const [error, setError] = useState("");
  const isAdmin = member?.role === "admin";
  const leaving = task.status === "request" && target !== "request";
  // Admin memilih PIC; desainer tanpa PIC otomatis jadi PIC; PIC lain tidak boleh memulai.
  const choosePic = leaving && isAdmin;
  const selfPic = leaving && !isAdmin && !task.pic ? member?.name : null;
  const blocked = leaving && !isAdmin && !!task.pic && task.pic !== member?.name;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const extra = {};
    if (blocked) return setError(notPicMessage(task.pic));
    if (choosePic) {
      if (!pic) return setError("Pilih PIC dulu.");
      if (pic !== task.pic) extra.pic = pic;
    }
    if (selfPic) extra.pic = selfPic;
    if (leaving && !canLeaveRequest({ ...task, ...extra }, member)) return setError(notPicMessage(task.pic));
    if (target === "delay") extra.delayReason = reason.trim() || null;
    if (target === "finish") {
      const filled = links.filter((l) => l.value.trim()).map((l) => ({ id: l.id, url: normalizeUrl(l.value) }));
      if (filled.some((l) => !l.url)) return setError("Ada link yang tidak valid. Contoh: https://drive.google.com/…");
      extra.resultLinks = filled;
    }
    const ok = await run(() => moveTask(task.id, target, extra), `Dipindah ke ${STATUS[target].label}.`);
    if (ok) onDone(target);
  };

  return (
    <Modal labelledBy="pindah-judul" onClose={onClose}>
      <form className="stack-lg" onSubmit={submit} noValidate>
        <div className="modal-head">
          <div className="grow">
            <h2 id="pindah-judul" className="h-section">Pindah ke…</h2>
            <p className="muted">{task.title} · sekarang di {STATUS[task.status].label}</p>
          </div>
          <button type="button" className="icon-btn icon-btn-close" aria-label="Tutup" onClick={onClose}><X size={18} /></button>
        </div>

        <div role="radiogroup" aria-label="Kolom tujuan" className="stack">
          {STATUSES.map((s) => {
            const current = s === task.status;
            return (
              <label key={s} className={`move-option ${target === s ? "selected" : ""} ${current ? "current" : ""}`}>
                <input type="radio" name="tujuan" className="checkbox" checked={target === s} disabled={current} onChange={() => setTarget(s)} />
                <span className={`dot dot-${s}`} />
                <span className="grow">
                  <strong>{STATUS[s].label}</strong>
                  <br />
                  <span className="small muted">{current ? "Posisi sekarang" : NOTES[s]}</span>
                </span>
              </label>
            );
          })}
        </div>

        {blocked && <p className="callout-cream" role="note">{notPicMessage(task.pic)}</p>}
        {selfPic && <p className="callout-cream" role="note">Kamu ({selfPic}) akan menjadi PIC task ini.</p>}
        {choosePic && (
          <div className="stack">
            <p className="label">PIC <span className="required">*</span></p>
            <div className="grid-2 keep">
              {designers.map((d) => (
                <button key={d.email} type="button" className={`btn btn-lg ${pic === d.name ? "btn-primary" : "btn-secondary"}`} aria-pressed={pic === d.name} onClick={() => setPic(d.name)}>
                  {d.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {target === "delay" && (
          <div className="field">
            <label className="label" htmlFor="alasan">Alasan ditunda <span className="muted" style={{ fontWeight: 400 }}>(opsional)</span></label>
            <input id="alasan" className="input" value={reason} placeholder="Contoh: menunggu foto produk dari Bidev" onChange={(e) => setReason(e.target.value)} />
            <p className="hint">Tampil di kartu. Waktu di Delay dicatat terpisah dari waktu pengerjaan.</p>
          </div>
        )}

        {target === "finish" && (
          <div className="stack">
            <label className="label" htmlFor={`hasil-${links[0].id}`}>Link hasil desain <span className="muted" style={{ fontWeight: 400 }}>(opsional)</span></label>
            {links.map((l, i) => (
              <div key={l.id} className="row" style={{ flexWrap: "nowrap" }}>
                <input
                  id={`hasil-${l.id}`}
                  type="text"
                  inputMode="url"
                  className={`input grow ${error ? "input-invalid" : ""}`}
                  placeholder="https://drive.google.com/…"
                  value={l.value}
                  aria-label={i ? `Link hasil ${i + 1}` : undefined}
                  onChange={(e) => setLinks(links.map((x) => (x.id === l.id ? { ...x, value: e.target.value } : x)))}
                />
                {links.length > 1 && (
                  <button type="button" className="icon-btn" aria-label={`Hapus link hasil ${i + 1}`} onClick={() => setLinks(links.filter((x) => x.id !== l.id))}><X size={16} /></button>
                )}
              </div>
            ))}
            <button type="button" className="btn btn-text" style={{ alignSelf: "flex-start" }} onClick={() => setLinks([...links, { id: newId(), value: "" }])}>
              <Plus size={16} aria-hidden="true" /> Tambah link lain
            </button>
            <p className="callout-cream">{(() => {
              const t = stageMinutes(task);
              return `Total waktu berhenti di ${fmtDuration(t.total)} (Request ${fmtDuration(t.request)} · On Progress ${fmtDuration(t.on_progress)} · Delay ${fmtDuration(t.delay)}).`;
            })()}</p>
          </div>
        )}

        {error && <p className="error-text" role="alert">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn btn-neutral" onClick={onClose}>Batal</button>
          <button type="submit" className="btn btn-primary btn-cta" disabled={busy || blocked}>Pindahkan ke {STATUS[target].label}</button>
        </div>
      </form>
    </Modal>
  );
}
