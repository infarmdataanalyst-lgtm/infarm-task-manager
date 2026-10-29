// /request/:id/edit — requester mengedit request-nya sendiri (tanpa login) selama status Request atau Todo.
// Form sama dengan form request, sudah terisi; field yang diubah ditandai, ringkasan perubahan di samping.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, LayoutList, Pencil } from "lucide-react";
import { CATEGORIES, DIVISIONS } from "../config";
import { useTasks } from "../data/useTasks";
import { canRequesterEdit, editRequest } from "../data/taskActions";
import { taskChanges } from "../data/taskModel";
import { describeChange } from "../lib/changes";
import { fmtDateTime, fmtDay, toYMD } from "../lib/dates";
import { normalizeUrl } from "../lib/links";
import { newId } from "../lib/images";
import ReferenceEditor from "../components/ReferenceEditor";
import { AppHeader, LocalModeBanner, ReferenceList, StatusBadge, referenceSummary, useAction, useToast } from "../components/ui";

// Deadline lama yang sudah lewat tetap boleh dipertahankan.
const minDue = (current) => {
  const todayYmd = toYMD(new Date());
  return current && current < todayYmd ? current : todayYmd;
};

const formFrom = (t) => ({
  requesterName: t.requesterName,
  division: t.division,
  title: t.title,
  category: t.category,
  dueDate: t.dueDate,
  description: t.description,
});

function ChangeList({ changes }) {
  return (
    <ul className="change-list">
      {changes.map((c) => {
        const { label, text } = describeChange(c);
        return (
          <li key={c.field}>
            <span className="change-label">{label}</span>
            <span>{text}</span>
          </li>
        );
      })}
    </ul>
  );
}

// Label field + tanda "Diubah" bila nilainya berbeda dari aslinya.
function FieldLabel({ htmlFor, children, changed, required = true }) {
  return (
    <label className="label" htmlFor={htmlFor}>
      {children} {required && <span className="required">*</span>} {changed && <span className="tag-changed">Diubah</span>}
    </label>
  );
}

export default function EditRequestPage() {
  const { id } = useParams();
  const { tasks, loading } = useTasks();
  const task = tasks.find((t) => t.id === id);
  const [original, setOriginal] = useState(null);
  const [form, setForm] = useState(null);
  const [images, setImages] = useState([]);
  const [links, setLinks] = useState([]);
  const [linkInput, setLinkInput] = useState("");
  const [saved, setSaved] = useState(null);
  const [toast, showToast] = useToast();
  const [run, busy] = useAction(showToast);

  const start = useCallback((t) => {
    setOriginal(t);
    setForm(formFrom(t));
    setImages(t.referenceImages);
    setLinks(t.referenceLinks);
    setLinkInput("");
    setSaved(null);
  }, []);

  // Form diisi sekali dari data saat halaman dibuka; perubahan dari tim di tengah jalan tidak menimpa isian.
  useEffect(() => {
    if (task && !original) start(task);
  }, [task, original, start]);

  const draft = useMemo(
    () => original && { ...original, ...form, title: form.title.trim(), requesterName: form.requesterName.trim(), description: form.description.trim(), referenceImages: images, referenceLinks: links },
    [original, form, images, links]
  );
  const changes = useMemo(() => (draft ? taskChanges(original, draft) : []), [original, draft]);
  const changed = (field) => changes.some((c) => c.field === field);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    let allLinks = links;
    if (linkInput.trim()) {
      const url = normalizeUrl(linkInput);
      if (!url) {
        showToast("Link referensi yang belum ditambahkan tidak valid. Perbaiki atau kosongkan dulu.", "error");
        return;
      }
      allLinks = [...links, { id: newId(), url }];
    }
    const updated = await run(() =>
      editRequest(id, {
        ...form,
        title: form.title.trim(),
        requesterName: form.requesterName.trim(),
        description: form.description.trim(),
        referenceImages: images.map(({ originalSize, ...img }) => img),
        referenceLinks: allLinks,
      })
    );
    if (!updated) return;
    setSaved({ task: updated, changes: taskChanges(original, updated) });
    window.scrollTo(0, 0);
  };

  const header = (
    <AppHeader title={saved ? "Perubahan tersimpan" : "Edit request"} subtitle={original?.title || "Request desain"} narrow>
      <Link to="/" className="btn btn-on-green" aria-label="Lihat status semua request">
        <LayoutList size={16} aria-hidden="true" />
        <span className="btn-label">Lihat status semua request</span>
      </Link>
    </AppHeader>
  );

  if (saved) {
    const t = saved.task;
    return (
      <>
        {header}
        <main className="container container-form page">
          <div className="row" style={{ gap: 14, flexWrap: "nowrap", alignItems: "center" }}>
            <span className="success-icon"><Check size={24} strokeWidth={2.5} aria-hidden="true" /></span>
            <div>
              <h1 className="h-page">Perubahan sudah tersimpan</h1>
              <p style={{ color: "var(--zinc-700)" }}>
                {t.pic ? `${t.pic} (PIC) sudah diberi tanda bahwa request ini diperbarui.` : "Tim desain langsung melihat versi terbaru request ini."}
              </p>
            </div>
          </div>
          <section className="card req-card">
            <div className="card-top">
              <StatusBadge status={t.status} />
              <span className="badge badge-updated">Diperbarui {fmtDateTime(t.requesterUpdatedAt)}</span>
              <span className="card-due">Deadline {fmtDay(t.dueDate)}</span>
            </div>
            <h2 className="req-title">{t.title}</h2>
            <p className="small muted">{t.category} · {t.requesterName} ({t.division})</p>
            <p className="small" style={{ color: "var(--zinc-700)" }}>{t.pic ? `PIC ${t.pic} · ` : ""}{referenceSummary(t)}</p>
            <div className="req-detail">
              <p className="eyebrow">Yang berubah</p>
              <ChangeList changes={saved.changes} />
              <p className="eyebrow">Referensi sekarang</p>
              <ReferenceList task={t} />
            </div>
          </section>
          <div className="row sent-actions">
            <Link to="/" className="btn btn-primary btn-cta">Kembali ke halaman status</Link>
            {canRequesterEdit(t) && (
              <button type="button" className="btn btn-secondary btn-lg" onClick={() => start(t)}>
                <Pencil size={16} aria-hidden="true" /> Edit lagi
              </button>
            )}
          </div>
        </main>
        {toast}
      </>
    );
  }

  if (loading || (task && !form)) {
    return (
      <>
        {header}
        <main className="container container-form page"><p className="muted">Memuat…</p></main>
      </>
    );
  }

  const current = task || original;
  if (!current || !canRequesterEdit(current)) {
    return (
      <>
        {header}
        <main className="container container-form page">
          <section className="card card-pad-lg stack" style={{ textAlign: "center" }}>
            <h1 className="h-section">{current ? "Request ini sudah tidak bisa diedit" : "Request tidak ditemukan"}</h1>
            <p className="muted">
              {!current
                ? "Mungkin sudah dihapus oleh tim desain."
                : current.status === "on_progress"
                  ? `Sedang dikerjakan ${current.pic}. Untuk perubahan, hubungi ${current.pic} langsung.`
                  : "Request ini sudah selesai. Kirim request baru bila perlu revisi besar."}
            </p>
            <Link to="/" className="btn btn-primary" style={{ alignSelf: "center" }}>Kembali ke halaman status</Link>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      {header}
      <main className="container container-narrow page">
        <LocalModeBanner />
        <section className="card edit-banner" aria-label="Status request">
          <StatusBadge status={current.status} />
          <p className="grow" style={{ color: "var(--zinc-700)" }}>
            {current.status === "todo" ? (
              <>Request ini sudah diambil <strong style={{ color: "var(--text)" }}>{current.pic}</strong> dan belum mulai dikerjakan. Perubahanmu akan ditandai supaya {current.pic} tahu.</>
            ) : (
              "Request ini belum diambil tim desain. Perubahanmu langsung terlihat oleh tim."
            )}
          </p>
          <span className="small muted">Dikirim {fmtDateTime(current.createdAt)}</span>
        </section>

        <form className="request-layout" onSubmit={submit}>
          <section className="main card card-pad-lg stack-lg" aria-labelledby="edit-heading">
            <h1 id="edit-heading" className="h-section">Detail request</h1>
            <div className="grid-2 keep">
              <div className="field">
                <FieldLabel htmlFor="f-name" changed={changed("requester_name")}>Nama kamu</FieldLabel>
                <input id="f-name" className={`input ${changed("requester_name") ? "input-changed" : ""}`} required value={form.requesterName} onChange={set("requesterName")} />
              </div>
              <div className="field">
                <FieldLabel htmlFor="f-division" changed={changed("division")}>Divisi</FieldLabel>
                <select id="f-division" className={`select ${changed("division") ? "input-changed" : ""}`} value={form.division} onChange={set("division")}>
                  {DIVISIONS.map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <FieldLabel htmlFor="f-title" changed={changed("title")}>Judul request</FieldLabel>
              <input id="f-title" className={`input ${changed("title") ? "input-changed" : ""}`} required value={form.title} onChange={set("title")} />
            </div>
            <div className="grid-2 keep">
              <div className="field">
                <FieldLabel htmlFor="f-category" changed={changed("category")}>Kategori</FieldLabel>
                <select id="f-category" className={`select ${changed("category") ? "input-changed" : ""}`} value={form.category} onChange={set("category")}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="field">
                <FieldLabel htmlFor="f-due" changed={changed("due_date")}>Deadline</FieldLabel>
                <input id="f-due" type="date" className={`input ${changed("due_date") ? "input-changed" : ""}`} required min={minDue(original.dueDate)} value={form.dueDate} onChange={set("dueDate")} />
                {changed("due_date") && <p className="hint">Sebelumnya {fmtDay(original.dueDate)}</p>}
              </div>
            </div>
            <div className="field">
              <FieldLabel htmlFor="f-brief" changed={changed("description")} required={false}>Brief</FieldLabel>
              <textarea id="f-brief" className={`textarea ${changed("description") ? "input-changed" : ""}`} rows={6} value={form.description} onChange={set("description")} />
              <p className="hint">Tulis ukuran, tone, teks yang wajib ada, dan tempat desain akan dipakai.</p>
            </div>
          </section>

          <aside className="side">
            <section className="card card-pad-lg stack" aria-labelledby="ref-heading">
              <h2 id="ref-heading" className="h-section">Referensi</h2>
              <p className="hint" style={{ marginTop: -4 }}>Hapus yang tidak perlu, atau tambah gambar dan link baru.</p>
              <ReferenceEditor
                images={images}
                links={links}
                onImagesChange={setImages}
                onLinksChange={setLinks}
                linkInput={linkInput}
                onLinkInputChange={setLinkInput}
                onError={(m) => showToast(m, "error")}
              />
            </section>

            <section className="card card-pad stack" aria-label="Ringkasan perubahan">
              <p className="eyebrow">{changes.length ? `${changes.length} perubahan belum disimpan` : "Belum ada perubahan"}</p>
              {changes.length > 0 && <ChangeList changes={changes} />}
              <div className="row edit-actions">
                <Link to="/" className="btn btn-neutral btn-lg">Batal</Link>
                <button type="submit" className="btn btn-primary btn-cta" disabled={busy || (!changes.length && !linkInput.trim())}>
                  <Check size={18} aria-hidden="true" />
                  {busy ? "Menyimpan…" : "Simpan perubahan"}
                </button>
              </div>
            </section>
          </aside>
        </form>
      </main>
      {toast}
    </>
  );
}
