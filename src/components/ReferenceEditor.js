// Input referensi di form request: upload gambar (dikompres otomatis) + link.

import React, { useRef, useState } from "react";
import { Link as LinkIcon, Upload, X } from "lucide-react";
import { compressImage, fmtBytes, newId } from "../lib/images";
import { displayUrl, normalizeUrl } from "../lib/links";

const MAX_IMAGES = 6;

// linkInput dikelola parent supaya link yang belum di-"Tambah" tetap ikut terkirim saat submit.
export default function ReferenceEditor({ images, links, onImagesChange, onLinksChange, linkInput, onLinkInputChange, onError }) {
  const fileRef = useRef(null);
  const [processing, setProcessing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [linkError, setLinkError] = useState("");

  const addFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith("image/"));
    if (!files.length) {
      onError("Hanya file gambar (JPG, PNG, WEBP) yang bisa di-upload. Untuk PDF atau file lain, tempel link Google Drive.");
      return;
    }
    const room = MAX_IMAGES - images.length;
    if (room <= 0) {
      onError(`Maksimal ${MAX_IMAGES} gambar per request.`);
      return;
    }
    setProcessing(true);
    const added = [];
    for (const file of files.slice(0, room)) {
      try {
        added.push(await compressImage(file));
      } catch (e) {
        onError(e.message);
      }
    }
    setProcessing(false);
    if (files.length > room) onError(`Maksimal ${MAX_IMAGES} gambar per request. Sebagian gambar tidak ditambahkan.`);
    onImagesChange([...images, ...added]);
  };

  const addLink = () => {
    const url = normalizeUrl(linkInput);
    if (!url) {
      setLinkError("Link tidak valid. Contoh: https://drive.google.com/…");
      return;
    }
    onLinksChange([...links, { id: newId(), url }]);
    onLinkInputChange("");
    setLinkError("");
  };

  return (
    <div className="stack-lg">
      <div className="stack">
        <p className="label">Gambar</p>
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
          <span style={{ fontWeight: 600 }}>{processing ? "Memproses gambar…" : "Klik atau tarik gambar ke sini"}</span>
          <span className="small" style={{ color: "var(--zinc-700)" }}>JPG, PNG, WEBP · dikecilkan otomatis · maks {MAX_IMAGES} gambar</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {images.length > 0 && (
          <div className="ref-grid">
            {images.map((img) => (
              <div key={img.id} className="ref-thumb">
                <img src={img.dataUrl} alt="" />
                <span className="caption" style={{ display: "block" }}>
                  {img.name} · {fmtBytes(img.size)}
                </span>
                <button type="button" className="remove" aria-label={`Hapus ${img.name}`} onClick={() => onImagesChange(images.filter((i) => i.id !== img.id))}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        {images.some((i) => i.originalSize > i.size) && (
          <p className="hint">
            Dikecilkan dari {fmtBytes(images.reduce((s, i) => s + (i.originalSize || 0), 0))} menjadi{" "}
            {fmtBytes(images.reduce((s, i) => s + i.size, 0))}.
          </p>
        )}
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
          <button type="button" className="btn btn-neutral" style={{ minHeight: 44 }} onClick={addLink}>
            Tambah
          </button>
        </div>
        <p id="ref-link-hint" className={linkError ? "error-text" : "hint"}>
          {linkError || "Pastikan link Google Drive bisa dibuka oleh siapa saja yang punya link."}
        </p>
      </div>
    </div>
  );
}
