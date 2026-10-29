// Dialog "Tandai selesai": wajib minimal satu link hasil, opsi hapus gambar referensi.

import React, { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { finishTask } from "../../data/taskActions";
import { newId, fmtBytes } from "../../lib/images";
import { normalizeUrl } from "../../lib/links";
import { Modal } from "../../components/ui";

export default function FinishDialog({ task, run, busy, onClose, onDone }) {
  const [inputs, setInputs] = useState(() =>
    task.resultLinks.length ? task.resultLinks.map((l) => ({ id: l.id, value: l.url })) : [{ id: newId(), value: "" }]
  );
  const [deleteImages, setDeleteImages] = useState(task.referenceImages.length > 0);
  const [error, setError] = useState("");
  const imageBytes = task.referenceImages.reduce((s, i) => s + (i.size || 0), 0);

  const update = (id, value) => setInputs(inputs.map((i) => (i.id === id ? { ...i, value } : i)));

  const submit = async (e) => {
    e.preventDefault();
    const filled = inputs.filter((i) => i.value.trim());
    const links = filled.map((i) => ({ id: i.id, url: normalizeUrl(i.value) }));
    if (!links.length) return setError("Isi minimal satu link hasil desain.");
    if (links.some((l) => !l.url)) return setError("Ada link yang tidak valid. Contoh: https://drive.google.com/…");
    const ok = await run(() => finishTask(task.id, { resultLinks: links, deleteReferenceImages: deleteImages }), "Task dipindah ke Finish.");
    if (ok) onDone();
  };

  return (
    <Modal labelledBy="finish-title" onClose={onClose}>
      <form className="stack-lg" onSubmit={submit} noValidate>
        <div className="modal-head">
          <span className="brand-logo" style={{ width: 40, height: 40, background: "var(--brand-surface)", color: "var(--brand-primary)" }} aria-hidden="true">
            <Check size={20} />
          </span>
          <div className="grow">
            <h2 id="finish-title" style={{ fontSize: 18, fontWeight: 600 }}>Tandai selesai</h2>
            <p className="muted">{task.title}{task.pic ? ` · PIC ${task.pic}` : ""}</p>
          </div>
          <button type="button" className="icon-btn icon-btn-plain" aria-label="Tutup" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="stack">
          <label className="label" htmlFor={`result-${inputs[0].id}`}>Link hasil desain <span className="required">*</span></label>
          {inputs.map((i, idx) => (
            <div key={i.id} className="row" style={{ flexWrap: "nowrap" }}>
              <input
                id={`result-${i.id}`}
                type="text"
                inputMode="url"
                className={`input grow ${error ? "input-invalid" : ""}`}
                placeholder="https://drive.google.com/…"
                value={i.value}
                autoFocus={idx === 0}
                onChange={(e) => {
                  update(i.id, e.target.value);
                  setError("");
                }}
                aria-label={idx === 0 ? undefined : `Link hasil ${idx + 1}`}
                aria-describedby="result-hint"
              />
              {inputs.length > 1 && (
                <button type="button" className="icon-btn" aria-label={`Hapus link hasil ${idx + 1}`} onClick={() => setInputs(inputs.filter((x) => x.id !== i.id))}>
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
          <p id="result-hint" className={error ? "error-text" : "hint"} role={error ? "alert" : undefined}>
            {error || "Wajib diisi. Requester akan melihat link ini di halaman status."}
          </p>
          <button type="button" className="btn btn-text" style={{ alignSelf: "flex-start" }} onClick={() => setInputs([...inputs, { id: newId(), value: "" }])}>
            <Plus size={16} aria-hidden="true" /> Tambah link lain
          </button>
        </div>

        {task.referenceImages.length > 0 && (
          <label className="callout-cream">
            <input type="checkbox" className="checkbox" style={{ marginTop: 2 }} checked={deleteImages} onChange={(e) => setDeleteImages(e.target.checked)} />
            <span>
              <span style={{ display: "block", fontWeight: 600 }}>Hapus gambar referensi setelah selesai</span>
              <span className="small" style={{ display: "block", color: "var(--brand-soil)" }}>
                {task.referenceImages.length} gambar{imageBytes ? ` (${fmtBytes(imageBytes)})` : ""}. Link referensi tetap disimpan. Hemat kuota penyimpanan.
              </span>
            </span>
          </label>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-neutral" style={{ minHeight: 44, borderRadius: 12 }} onClick={onClose}>Batal</button>
          <button type="submit" className="btn btn-primary btn-cta" disabled={busy}>Simpan dan pindah ke Finish</button>
        </div>
      </form>
    </Modal>
  );
}
