// Komponen kecil yang dipakai di banyak halaman.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, FileText, Link as LinkIcon, X } from "lucide-react";
import { STATUS, STORAGE_MODE } from "../config";
import { displayUrl } from "../lib/links";
import { fmtBytes } from "../lib/images";

export function AppHeader({ title, subtitle, to = "/", narrow = false, center, children }) {
  return (
    <header className="app-header">
      <div className={`container ${narrow ? "container-narrow" : ""}`}>
        <Link to={to} className="brand">
          <span className="brand-logo">
            <img src="/logo-infarm.png" alt="Logo Infarm" />
          </span>
          <span style={{ minWidth: 0 }}>
            <span className="brand-title">{title}</span>
            {subtitle && <span className="brand-sub">{subtitle}</span>}
          </span>
        </Link>
        {center}
        {children && <div className="header-actions">{children}</div>}
      </div>
    </header>
  );
}

// Peringatan selama data masih di localStorage (sebelum Supabase diatur).
export function LocalModeBanner() {
  if (STORAGE_MODE !== "local") return null;
  return (
    <p className="local-banner" role="note">
      Mode uji coba: data tersimpan di browser ini saja dan login memakai akun tiruan. Atur variabel Supabase di Vercel untuk
      memakai database bersama dan login Google.
    </p>
  );
}

export const StatusBadge = ({ status }) => <span className={`badge badge-${status}`}>{STATUS[status]?.label}</span>;

export const Avatar = ({ name, color, size = 24 }) => (
  <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.45), background: color || "#6b7280" }} aria-hidden="true">
    {name?.[0]}
  </span>
);

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
        return result === undefined ? true : result;
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

// Waktu sekarang yang diperbarui berkala (untuk angka waktu kerja yang berjalan).
export function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function Modal({ labelledBy, onClose, className = "", children }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="modal-wrap" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${className}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
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
      <img src={image.url} alt={image.name} onClick={(e) => e.stopPropagation()} />
      <p>{image.name}</p>
      <button type="button" className="btn btn-on-green" onClick={onClose}>
        <X size={16} /> Tutup
      </button>
    </div>
  );
}

// Lampiran mini di kartu: maks 3 + "+n". Foto memakai thumbnail kecil supaya hemat kuota transfer.
export function AttachmentStrip({ attachments }) {
  if (!attachments.length) return null;
  const shown = attachments.slice(0, 3);
  const more = attachments.length - shown.length;
  return (
    <div className="file-strip" aria-label={`${attachments.length} lampiran`}>
      {shown.map((a) => (
        <span key={a.id} className={`file-mini ${a.type === "pdf" ? "pdf" : "image"}`} title={a.name}>
          {a.type === "pdf" ? "PDF" : a.thumbUrl || a.url ? <img src={a.thumbUrl || a.url} alt="" loading="lazy" /> : "JPG"}
        </span>
      ))}
      {more > 0 && <span className="file-mini more">+{more}</span>}
    </div>
  );
}

// Lampiran di detail: foto bisa diperbesar, PDF dibuka di tab baru.
export function AttachmentList({ task }) {
  const [zoom, setZoom] = useState(null);
  if (!task.attachments.length) {
    return <p className="empty-box">{task.attachmentsDeletedAt ? "Lampiran sudah dihapus otomatis setelah task selesai." : "Tidak ada lampiran."}</p>;
  }
  return (
    <div className="file-grid">
      {task.attachments.map((a) =>
        a.type === "pdf" ? (
          <a key={a.id} className="file-tile pdf" href={a.url || undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!a.url}>
            <span className="thumb"><FileText size={24} aria-hidden="true" /></span>
            <span className="caption" style={{ display: "block" }}>{a.name}{a.size ? ` · ${fmtBytes(a.size)}` : ""}</span>
          </a>
        ) : (
          <button key={a.id} type="button" className="file-tile" onClick={() => setZoom(a)} aria-label={`Perbesar ${a.name}`}>
            <span className="thumb">{a.thumbUrl || a.url ? <img src={a.thumbUrl || a.url} alt="" loading="lazy" /> : "JPG"}</span>
            <span className="caption" style={{ display: "block" }}>{a.name}{a.size ? ` · ${fmtBytes(a.size)}` : ""}</span>
          </button>
        )
      )}
      {zoom && <Lightbox image={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}

export function LinkList({ links, emptyText }) {
  if (!links.length) return emptyText ? <p className="empty-box">{emptyText}</p> : null;
  return (
    <div className="stack">
      {links.map((l) => (
        <a key={l.id} className="link-row link-row-added" href={l.url} target="_blank" rel="noopener noreferrer">
          <LinkIcon size={16} aria-hidden="true" />
          <span className="url">{displayUrl(l.url)}</span>
          <ExternalLink size={14} aria-hidden="true" />
        </a>
      ))}
    </div>
  );
}
