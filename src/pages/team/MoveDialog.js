// Dialog "Pindah ke…": pilih kolom tujuan (maju atau mundur) beserta isian yang dibutuhkan.
// - Dari Request ke kolom lain: pilih PIC dulu.
// - Ke Delay: alasan (opsional), tampil di kartu. Waktu kerja berhenti.
// - Ke Finish: link hasil wajib. Waktu kerja berhenti.
// - Ke Request: PIC dilepas; waktu yang sudah tercatat tetap disimpan.

import React, { useState } from "react";
import { Plus, X } from "lucide-react";
import { STATUS, STATUSES } from "../../config";
import { moveTask } from "../../data/taskActions";
import { newId } from "../../lib/images";
import { normalizeUrl } from "../../lib/links";
import { fmtDuration, taskWorkMinutes } from "../../lib/worktime";
import { Modal } from "../../components/ui";

const NOTES = {
  request: "PIC dilepas; waktu yang sudah tercatat tetap disimpan",
  on_progress: "Dikerjakan; waktu kerja berjalan",
  delay: "Ditunda karena menunggu sesuatu; waktu kerja berhenti",
  finish: "Wajib isi link hasil; waktu kerja berhenti",
};

export default function MoveDialog({ task, initialTarget, designers, run, busy, onClose, onDone }) {
  const [target, setTarget] = useState(initialTarget && initialTarget !== task.status ? initialTarget : STATUSES.find((s) => s !== task.status));
  const [pic, setPic] = useState(task.pic || "");
  const [reason, setReason] = useState(task.delayReason || "");
  const [links, setLinks] = useState(() =>
    task.resultLinks.length ? task.resultLinks.map((l) => ({ id: l.id, value: l.url })) : [{ id: newId(), value: "" }]
  );
  const [error, setError] = useState("");
  const needsPic = !task.pic && target !== "request";

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const extra = {};
    if (needsPic) {
      if (!pic) return setError("Pilih PIC dulu.");
      extra.pic = pic;
    }
    if (target === "delay") extra.delayReason = reason.trim() || null;
    if (target === "finish") {
      const filled = links.filter((l) => l.value.trim()).map((l) => ({ id: l.id, url: normalizeUrl(l.value) }));
      if (!filled.length) return setError("Isi minimal satu link hasil desain.");
      if (filled.some((l) => !l.url)) return setError("Ada link yang tidak valid. Contoh: https://drive.google.com/…");
      extra.resultLinks = filled;
    }
    const ok = await run(() => moveTask(task.id, target, extra), `Dipindah ke ${STATUS[target].label}.`);
    if (ok) onDone();
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

        {needsPic && (
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
            <p className="hint">Tampil di kartu. Waktu kerja berhenti selama di Delay dan lanjut saat kembali ke On Progress.</p>
          </div>
        )}

        {target === "finish" && (
          <div className="stack">
            <label className="label" htmlFor={`hasil-${links[0].id}`}>Link hasil desain <span className="required">*</span></label>
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
            <p className="callout-cream">Waktu kerja berhenti di {fmtDuration(taskWorkMinutes(task))}.</p>
          </div>
        )}

        {error && <p className="error-text" role="alert">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn btn-neutral" onClick={onClose}>Batal</button>
          <button type="submit" className="btn btn-primary btn-cta" disabled={busy}>Pindahkan ke {STATUS[target].label}</button>
        </div>
      </form>
    </Modal>
  );
}
