// "/" — form request desain untuk divisi lain (tanpa login), lalu konfirmasi "Request sudah masuk".
// Requester tidak bisa melihat board atau progres; konfirmasi menampilkan isian yang dikirim.

import React, { useState } from "react";
import { Check, FileText, Info, Send } from "lucide-react";
import { CATEGORIES, DIVISIONS } from "../config";
import { submitRequest } from "../data/taskActions";
import { fmtDateTime, fmtDay, toYMD } from "../lib/dates";
import { displayUrl, normalizeUrl } from "../lib/links";
import { fmtBytes, newId } from "../lib/images";
import ReferenceEditor from "../components/ReferenceEditor";
import { AppHeader, LocalModeBanner, useAction, useToast } from "../components/ui";

const EMPTY = { requesterName: "", division: DIVISIONS[0], title: "", category: CATEGORIES[0], dueDate: "", description: "" };

function SentPage({ sent, onAgain }) {
  return (
    <main className="container container-form page">
      <div className="row" style={{ gap: 14, flexWrap: "nowrap" }}>
        <span className="success-icon"><Check size={24} strokeWidth={2.5} aria-hidden="true" /></span>
        <div>
          <h1 className="h-page">Request sudah masuk</h1>
          <p style={{ color: "var(--zinc-700)" }}>Request langsung muncul di board tim desain. Simpan ringkasan ini kalau perlu.</p>
        </div>
      </div>
      <section className="card sent-card">
        <div className="card-top">
          <span className="tag tag-category">{sent.category}</span>
          <span className="small muted" style={{ marginLeft: "auto" }}>Deadline {fmtDay(sent.dueDate)}</span>
        </div>
        <h2 className="h-section">{sent.title}</h2>
        <p className="small muted">{sent.requesterName} ({sent.division}) · dikirim {fmtDateTime(sent.createdAt)}</p>
        {sent.description && <p style={{ color: "var(--zinc-700)", whiteSpace: "pre-line" }}>{sent.description}</p>}
        <div className="stack" style={{ borderTop: "1px solid var(--zinc-100)", paddingTop: 10 }}>
          <p className="eyebrow">Lampiran dan link yang dikirim</p>
          {!sent.attachments.length && !sent.referenceLinks.length && <p className="muted">Tanpa lampiran dan link.</p>}
          {sent.attachments.map((a) => (
            <p key={a.id} className="row small" style={{ gap: 6 }}>
              <FileText size={14} aria-hidden="true" /> {a.name} · {fmtBytes(a.size)}
            </p>
          ))}
          {sent.referenceLinks.map((l) => (
            <a key={l.id} className="small" href={l.url} target="_blank" rel="noopener noreferrer">{displayUrl(l.url)}</a>
          ))}
        </div>
      </section>
      <p className="callout-cream">
        <Info size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
        <span>Ada yang kurang atau berubah? Hubungi Denny atau Arum langsung. Request yang sudah terkirim tidak bisa diedit dari form.</span>
      </p>
      <div className="row sent-actions">
        <button type="button" className="btn btn-primary btn-cta" onClick={onAgain}>Kirim request lain</button>
      </div>
    </main>
  );
}

export default function RequestPage() {
  const [form, setForm] = useState(EMPTY);
  const [attachments, setAttachments] = useState([]);
  const [links, setLinks] = useState([]);
  const [linkInput, setLinkInput] = useState("");
  const [sent, setSent] = useState(null);
  const [toast, showToast] = useToast();
  const [run, busy] = useAction(showToast);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    let allLinks = links;
    if (linkInput.trim()) {
      const url = normalizeUrl(linkInput);
      if (!url) return showToast("Link referensi yang belum ditambahkan tidak valid. Perbaiki atau kosongkan dulu.", "error");
      allLinks = [...links, { id: newId(), url }];
    }
    const created = await run(() =>
      submitRequest({
        ...form,
        title: form.title.trim(),
        requesterName: form.requesterName.trim(),
        description: form.description.trim(),
        attachments,
        referenceLinks: allLinks,
      })
    );
    if (!created) return;
    setSent(created);
    window.scrollTo(0, 0);
  };

  const reset = () => {
    attachments.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl));
    setForm(EMPTY);
    setAttachments([]);
    setLinks([]);
    setLinkInput("");
    setSent(null);
  };

  return (
    <>
      <AppHeader title="Request desain" subtitle="Kirim kebutuhan desain ke Tim Desain infarm.id" narrow />
      {sent ? (
        <SentPage sent={sent} onAgain={reset} />
      ) : (
        <main className="container container-narrow page">
          <LocalModeBanner />
          <form className="request-layout" onSubmit={submit}>
            <section className="main card card-pad-lg stack-lg" aria-labelledby="detail-heading">
              <h1 id="detail-heading" className="h-section">Detail request</h1>
              <div className="grid-2 keep">
                <div className="field">
                  <label className="label" htmlFor="f-name">Nama kamu <span className="required">*</span></label>
                  <input id="f-name" className="input" required autoComplete="name" value={form.requesterName} onChange={set("requesterName")} />
                </div>
                <div className="field">
                  <label className="label" htmlFor="f-division">Divisi <span className="required">*</span></label>
                  <select id="f-division" className="select" value={form.division} onChange={set("division")}>
                    {DIVISIONS.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div className="field">
                <label className="label" htmlFor="f-title">Judul request <span className="required">*</span></label>
                <input id="f-title" className="input" required placeholder="Contoh: Banner Flash Sale 11.11 Shopee" value={form.title} onChange={set("title")} />
              </div>
              <div className="grid-2 keep">
                <div className="field">
                  <label className="label" htmlFor="f-category">Kategori <span className="required">*</span></label>
                  <select id="f-category" className="select" value={form.category} onChange={set("category")}>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="label" htmlFor="f-due">Deadline <span className="required">*</span></label>
                  <input id="f-due" type="date" className="input" required min={toYMD(new Date())} value={form.dueDate} onChange={set("dueDate")} />
                </div>
              </div>
              <div className="field">
                <label className="label" htmlFor="f-brief">Brief</label>
                <textarea id="f-brief" className="textarea" rows={6} value={form.description} onChange={set("description")} aria-describedby="f-brief-hint" />
                <p id="f-brief-hint" className="hint">Tulis kebutuhan secara keseluruhan: ukuran, tone, teks yang wajib ada, dan tempat desain akan dipakai.</p>
              </div>
            </section>

            <aside className="side">
              <section className="card card-pad-lg stack" aria-labelledby="ref-heading">
                <h2 id="ref-heading" className="h-section">Lampiran dan referensi</h2>
                <p className="hint" style={{ marginTop: -4 }}>Upload foto/PDF dan/atau tempel link.</p>
                <ReferenceEditor
                  attachments={attachments}
                  links={links}
                  onAttachmentsChange={setAttachments}
                  onLinksChange={setLinks}
                  linkInput={linkInput}
                  onLinkInputChange={setLinkInput}
                  onError={(m) => showToast(m, "error")}
                />
              </section>
              <button type="submit" className="btn btn-primary btn-cta btn-block" disabled={busy}>
                <Send size={18} aria-hidden="true" />
                {busy ? "Mengirim…" : "Kirim request"}
              </button>
            </aside>
          </form>
        </main>
      )}
      {toast}
    </>
  );
}
