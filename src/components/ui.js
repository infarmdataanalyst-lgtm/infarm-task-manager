// Komponen kecil yang dipakai di banyak halaman.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, ExternalLink, FileText, Link as LinkIcon, X } from "lucide-react";
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

// Tumpukan pop-up yang terbuka: Escape hanya menutup yang paling atas.
const modalStack = [];

export function Modal({ labelledBy, onClose, className = "", children }) {
  useEffect(() => {
    const token = {};
    modalStack.push(token);
    const onKey = (e) => e.key === "Escape" && modalStack[modalStack.length - 1] === token && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      modalStack.splice(modalStack.indexOf(token), 1);
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

// Pratinjau foto layar penuh. images: [{ name, url }]; bisa digeser dengan tombol, panah keyboard, atau geser jari.
export function Lightbox({ images, index: startIndex = 0, onClose }) {
  const [index, setIndex] = useState(startIndex);
  const touchX = useRef(null);
  const count = images.length;
  const go = useCallback((step) => setIndex((i) => (i + step + count) % count), [count]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose, go]);
  const image = images[index];
  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`${image.name} (${index + 1} dari ${count})`}
      onClick={onClose}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - (touchX.current ?? e.changedTouches[0].clientX);
        if (count > 1 && Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
    >
      <div className="lightbox-stage" onClick={(e) => e.stopPropagation()}>
        {count > 1 && (
          <button type="button" className="lightbox-nav prev" aria-label="Foto sebelumnya" onClick={() => go(-1)}>
            <ChevronLeft size={28} />
          </button>
        )}
        <img src={image.url} alt={image.name} />
        {count > 1 && (
          <button type="button" className="lightbox-nav next" aria-label="Foto berikutnya" onClick={() => go(1)}>
            <ChevronRight size={28} />
          </button>
        )}
      </div>
      <p onClick={(e) => e.stopPropagation()}>
        {image.name}
        {count > 1 && <span className="lightbox-count"> · {index + 1} / {count}</span>}
      </p>
      {count > 1 && (
        <div className="lightbox-thumbs" onClick={(e) => e.stopPropagation()}>
          {images.map((im, i) => (
            <button key={im.url + i} type="button" className={i === index ? "active" : ""} aria-label={`Lihat ${im.name}`} aria-current={i === index} onClick={() => setIndex(i)}>
              <img src={im.thumbUrl || im.url} alt="" />
            </button>
          ))}
        </div>
      )}
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
// onRemove (opsional): tampilkan tombol hapus di setiap lampiran (tim desain di pop-up detail).
export function AttachmentList({ task, onRemove }) {
  const [zoom, setZoom] = useState(null); // indeks foto yang dibuka
  const photos = task.attachments.filter((a) => a.type !== "pdf" && a.url);
  if (!task.attachments.length) {
    return <p className="empty-box">{task.attachmentsDeletedAt ? "Lampiran sudah dihapus otomatis setelah task selesai." : "Tidak ada lampiran."}</p>;
  }
  return (
    <div className="file-grid">
      {task.attachments.map((a) => (
        <div key={a.id} className="file-tile-wrap">
          {a.type === "pdf" ? (
            <a className="file-tile pdf" href={a.url || undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!a.url}>
              <span className="thumb"><FileText size={24} aria-hidden="true" /></span>
              <span className="caption" style={{ display: "block" }}>{a.name}{a.size ? ` · ${fmtBytes(a.size)}` : ""}</span>
            </a>
          ) : (
            <button type="button" className="file-tile" onClick={() => a.url && setZoom(photos.indexOf(a))} aria-label={`Perbesar ${a.name}`}>
              <span className="thumb">{a.thumbUrl || a.url ? <img src={a.thumbUrl || a.url} alt="" loading="lazy" /> : "JPG"}</span>
              <span className="caption" style={{ display: "block" }}>{a.name}{a.size ? ` · ${fmtBytes(a.size)}` : ""}</span>
            </button>
          )}
          {onRemove && (
            <button type="button" className="remove" aria-label={`Hapus lampiran ${a.name}`} onClick={() => onRemove(a)}>
              <X size={14} />
            </button>
          )}
        </div>
      ))}
      {zoom !== null && zoom >= 0 && <Lightbox images={photos} index={zoom} onClose={() => setZoom(null)} />}
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
