// Komponen kecil yang dipakai di banyak halaman.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Link as LinkIcon, X } from "lucide-react";
import { STATUS, STATUSES, STORAGE_MODE, designerColor } from "../config";
import { displayUrl } from "../lib/links";
import { fmtBytes } from "../lib/images";

export function AppHeader({ title, subtitle, to = "/", children }) {
  return (
    <header className="app-header">
      <div className="container">
        <Link to={to} className="brand">
          <span className="brand-logo">
            <img src="/logo-infarm.png" alt="Logo Infarm" />
          </span>
          <span className="grow">
            <span className="brand-title" style={{ display: "block" }}>{title}</span>
            {subtitle && <span className="brand-sub" style={{ display: "block" }}>{subtitle}</span>}
          </span>
        </Link>
        {children && <div className="header-actions">{children}</div>}
      </div>
    </header>
  );
}

// Peringatan selama data masih di localStorage (sebelum Supabase).
export function LocalModeBanner() {
  if (STORAGE_MODE !== "local") return null;
  return (
    <p className="local-banner" role="note">
      Mode uji coba: data masih tersimpan di browser ini saja, belum di server. Request dari perangkat lain belum
      terlihat di sini sampai database dipasang.
    </p>
  );
}

export const StatusBadge = ({ status }) => <span className={`badge badge-${status}`}>{STATUS[status]?.label}</span>;

export const Avatar = ({ name, size = 24 }) => (
  <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.45), background: designerColor(name) }} aria-hidden="true">
    {name?.[0]}
  </span>
);

export function Stepper({ status, showLabels = true }) {
  const step = STATUS[status]?.step || 1;
  return (
    <ol className="stepper" aria-label={`Tahap ${step} dari 4: ${STATUS[status]?.label}`}>
      {STATUSES.map((s) => {
        const n = STATUS[s].step;
        const cls = [n <= step ? "done" : "", n === step ? "current" : ""].join(" ");
        return (
          <li key={s} className={cls} aria-current={n === step ? "step" : undefined}>
            <span className="bar" />
            {showLabels && <span>{STATUS[s].label}</span>}
          </li>
        );
      })}
    </ol>
  );
}

export function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const show = useCallback((message, type = "info") => {
    clearTimeout(timer.current);
    setToast({ message, type });
    timer.current = setTimeout(() => setToast(null), type === "error" ? 7000 : 3500);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const node = toast && (
    <div className={`toast ${toast.type === "error" ? "toast-error" : ""}`} role={toast.type === "error" ? "alert" : "status"}>
      <span className="grow">{toast.message}</span>
      <button type="button" className="icon-btn icon-btn-plain" style={{ color: "#fff" }} aria-label="Tutup pesan" onClick={() => setToast(null)}>
        <X size={16} />
      </button>
    </div>
  );
  return [node, show];
}

// Menjalankan aksi async dan menampilkan error lewat toast.
export function useAction(showToast) {
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async (fn, successMessage) => {
      setBusy(true);
      try {
        const result = await fn();
        if (successMessage) showToast(successMessage);
        return result;
      } catch (e) {
        showToast(e.message || "Terjadi kesalahan. Coba lagi.", "error");
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [showToast]
  );
  return [run, busy];
}

export function Modal({ labelledBy, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-wrap" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        {children}
      </div>
    </div>
  );
}

export function Lightbox({ image, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={image.name} onClick={onClose}>
      <img src={image.dataUrl || image.url} alt={image.name} onClick={(e) => e.stopPropagation()} />
      <p>{image.name}</p>
      <button type="button" className="btn btn-on-green" onClick={onClose}>
        <X size={16} /> Tutup
      </button>
    </div>
  );
}

// Daftar gambar & link referensi (hanya tampil).
export function ReferenceList({ task }) {
  const [zoom, setZoom] = useState(null);
  const { referenceImages: images, referenceLinks: links } = task;
  if (!images.length && !links.length) {
    return (
      <p className="empty-box">
        {task.referenceImagesDeletedAt ? "Gambar referensi sudah dihapus setelah task selesai." : "Tidak ada referensi."}
      </p>
    );
  }
  return (
    <div className="stack">
      {images.length > 0 && (
        <div className="ref-grid">
          {images.map((img) => (
            <button key={img.id} type="button" className="ref-thumb" onClick={() => setZoom(img)} aria-label={`Perbesar ${img.name}`}>
              <img src={img.dataUrl || img.url} alt="" loading="lazy" />
              <span className="caption" style={{ display: "block" }}>
                {img.name}
                {img.size ? ` · ${fmtBytes(img.size)}` : ""}
              </span>
            </button>
          ))}
        </div>
      )}
      {task.referenceImagesDeletedAt && !images.length && (
        <p className="hint">Gambar referensi sudah dihapus setelah task selesai.</p>
      )}
      {links.map((l) => (
        <a key={l.id} className="link-row" href={l.url} target="_blank" rel="noopener noreferrer">
          <LinkIcon size={16} aria-hidden="true" />
          <span className="url">{displayUrl(l.url)}</span>
          <ExternalLink size={14} aria-hidden="true" style={{ marginRight: 8 }} />
        </a>
      ))}
      {zoom && <Lightbox image={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}

export const referenceSummary = (task) => {
  const parts = [];
  if (task.referenceImages.length) parts.push(`${task.referenceImages.length} gambar`);
  if (task.referenceLinks.length) parts.push(`${task.referenceLinks.length} link`);
  if (!parts.length && task.referenceImagesDeletedAt) return "gambar sudah dihapus";
  return parts.join(" · ") || "tidak ada";
};
