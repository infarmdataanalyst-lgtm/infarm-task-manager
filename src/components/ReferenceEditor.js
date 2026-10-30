// Input lampiran (foto + PDF, maks 5) dan link referensi di form request.

import React, { useRef, useState } from "react";
import { FileText, Link as LinkIcon, Upload, X } from "lucide-react";
import { MAX_ATTACHMENTS } from "../config";
import { fmtBytes, newId, prepareAttachment } from "../lib/images";
import { displayUrl, normalizeUrl } from "../lib/links";

// linkInput dikelola parent supaya link yang belum di-"Tambah" tetap ikut terkirim saat submit.
export default function ReferenceEditor({ attachments, links, onAttachmentsChange, onLinksChange, linkInput, onLinkInputChange, onError }) {
  const fileRef = useRef(null);
  const [processing, setProcessing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [linkError, setLinkError] = useState("");

  const addFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const room = MAX_ATTACHMENTS - attachments.length;
    if (room <= 0) return onError(`Maksimal ${MAX_ATTACHMENTS} file per request.`);
    setProcessing(true);
    const added = [];
    for (const file of files.slice(0, room)) {
      try {
        added.push(await prepareAttachment(file));
      } catch (e) {
        onError(e.message);
      }
    }
    setProcessing(false);
    if (files.length > room) onError(`Maksimal ${MAX_ATTACHMENTS} file per request. Sebagian file tidak ditambahkan.`);
    onAttachmentsChange([...attachments, ...added]);
  };

  const remove = (a) => {
    if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
    onAttachmentsChange(attachments.filter((x) => x.id !== a.id));
  };

  const addLink = () => {
    const url = normalizeUrl(linkInput);
    if (!url) return setLinkError("Link tidak valid. Contoh: https://drive.google.com/…");
    onLinksChange([...links, { id: newId(), url }]);
    onLinkInputChange("");
    setLinkError("");
  };

  const original = attachments.reduce((s, a) => s + (a.originalSize || 0), 0);
  const saved = attachments.reduce((s, a) => s + a.size, 0);

  return (
    <div className="stack-lg">
      <div className="stack">
        <p className="label row-between">
          <span>Lampiran</span>
          <span className="small" style={{ color: "var(--brand-primary)" }}>{attachments.length} dari {MAX_ATTACHMENTS} file</span>
        </p>
        {attachments.length < MAX_ATTACHMENTS && (
          <button
            type="button"
            className={`dropzone ${dragging ? "dragging" : ""}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              addFiles(e.dataTransfer.files);
            }}
            disabled={processing}
          >
            <Upload size={22} aria-hidden="true" />
            <span style={{ fontWeight: 600 }}>{processing ? "Memproses file…" : "Klik atau tarik file ke sini"}</span>
            <span className="small" style={{ color: "var(--zinc-700)" }}>JPG, PNG, WEBP, PDF · maks {MAX_ATTACHMENTS} file · foto dikecilkan otomatis · PDF maks 5 MB</span>
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf,.pdf"
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {attachments.length > 0 && (
          <div className="file-grid">
            {attachments.map((a) => (
              <div key={a.id} className={`file-tile ${a.type === "pdf" ? "pdf" : ""}`}>
                <span className="thumb">{a.type === "pdf" ? <FileText size={24} aria-hidden="true" /> : <img src={a.previewUrl} alt="" />}</span>
                <span className="caption" style={{ display: "block" }}>{a.name} · {fmtBytes(a.size)}</span>
                <button type="button" className="remove" aria-label={`Hapus ${a.name}`} onClick={() => remove(a)}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        {original > saved && <p className="hint">Foto dikecilkan dari {fmtBytes(original)} menjadi {fmtBytes(saved)}.</p>}
      </div>

      <div className="stack">
        <label className="label" htmlFor="ref-link">Link referensi</label>
        {links.map((l) => (
          <div key={l.id} className="link-row link-row-added">
            <LinkIcon size={16} color="var(--brand-primary)" aria-hidden="true" />
            <span className="url">{displayUrl(l.url)}</span>
            <button type="button" className="icon-btn icon-btn-plain" style={{ color: "var(--rose-600)" }} aria-label={`Hapus link ${displayUrl(l.url)}`} onClick={() => onLinksChange(links.filter((x) => x.id !== l.id))}>
              <X size={16} />
            </button>
          </div>
        ))}
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <input
            id="ref-link"
            type="text"
            inputMode="url"
            className={`input grow ${linkError ? "input-invalid" : ""}`}
            placeholder="Tempel link Google Drive, Pinterest, dll."
            value={linkInput}
            onChange={(e) => onLinkInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addLink();
              }
            }}
            aria-invalid={!!linkError}
            aria-describedby="ref-link-hint"
          />
          <button type="button" className="btn btn-neutral" onClick={addLink}>Tambah</button>
        </div>
        <p id="ref-link-hint" className={linkError ? "error-text" : "hint"}>
          {linkError || "Pastikan link Google Drive bisa dibuka oleh siapa saja yang punya link."}
        </p>
      </div>
    </div>
  );
}
