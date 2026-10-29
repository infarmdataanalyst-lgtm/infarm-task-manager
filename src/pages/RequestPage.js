// /request — form request desain untuk divisi lain, lalu konfirmasi "Request sudah masuk".

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Send } from "lucide-react";
import { CATEGORIES, DIVISIONS } from "../config";
import { submitRequest } from "../data/taskActions";
import { getTask } from "../data/taskStore";
import { fmtDateTime, fmtDay, toYMD } from "../lib/dates";
import { normalizeUrl } from "../lib/links";
import { newId } from "../lib/images";
import ReferenceEditor from "../components/ReferenceEditor";
import { AppHeader, LocalModeBanner, ReferenceList, StatusBadge, useAction, useToast } from "../components/ui";

const EMPTY = { requesterName: "", division: DIVISIONS[0], title: "", category: CATEGORIES[0], dueDate: "", description: "" };

export default function RequestPage() {
  const [form, setForm] = useState(EMPTY);
  const [images, setImages] = useState([]);
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
      if (!url) {
        showToast("Link referensi yang belum ditambahkan tidak valid. Perbaiki atau kosongkan dulu.", "error");
        return;
      }
      allLinks = [...links, { id: newId(), url }];
    }
    const created = await run(() =>
      submitRequest({
        ...form,
        title: form.title.trim(),
        requesterName: form.requesterName.trim(),
        description: form.description.trim(),
        referenceImages: images.map(({ originalSize, ...img }) => img),
        referenceLinks: allLinks,
      })
    );
    if (!created) return;
    // Baca ulang dari penyimpanan: yang ditampilkan = yang benar-benar tersimpan.
    setSent(await getTask(created.id));
    window.scrollTo(0, 0);
  };

  const reset = () => {
    setForm(EMPTY);
    setImages([]);
    setLinks([]);
    setLinkInput("");
    setSent(null);
  };

  return (
    <>
      <AppHeader title="Request desain" subtitle="Kirim kebutuhan desain ke Tim Desain infarm.id">
        <Link to="/" className="btn btn-on-green">
          <span className="btn-label">Lihat status semua request</span>
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </AppHeader>

      {sent ? (
        <main className="container container-form page">
          <div className="row" style={{ gap: 16, flexWrap: "nowrap", alignItems: "center" }}>
            <span className="success-icon"><Check size={28} strokeWidth={2.5} aria-hidden="true" /></span>
            <div>
              <h1 className="h-page">Request sudah masuk</h1>
              <p style={{ color: "var(--zinc-700)" }}>Tersimpan di sistem tim desain. Cek di bawah apakah referensimu terbaca dengan benar.</p>
            </div>
          </div>
          <section className="card card-pad-lg stack-lg">
            <div className="row-between">
              <span className="row">
                <StatusBadge status={sent.status} />
                <span className="small" style={{ color: "var(--zinc-700)" }}>Menunggu diambil Denny atau Arum</span>
              </span>
              <span className="small muted">Dikirim {fmtDateTime(sent.createdAt)}</span>
            </div>
            <div>
              <h2 className="h-section">{sent.title}</h2>
              <p className="small muted">
                {sent.category} · {sent.requesterName} ({sent.division}) · deadline {fmtDay(sent.dueDate)}
              </p>
            </div>
            <div className="stack" style={{ borderTop: "1px solid var(--zinc-100)", paddingTop: 14 }}>
              <p className="label">Referensi yang kami terima</p>
              <ReferenceList task={sent} />
              <p className="hint">Ada yang kurang? Kabari tim desain, atau kirim request baru.</p>
            </div>
          </section>
          <div className="row">
            <Link to="/" className="btn btn-primary btn-cta">Lihat di halaman status</Link>
            <button type="button" className="btn btn-secondary btn-lg" onClick={reset}>
              Kirim request lain
            </button>
          </div>
        </main>
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
                <p id="f-brief-hint" className="hint">Tulis ukuran, tone, teks yang wajib ada, dan tempat desain akan dipakai.</p>
              </div>
            </section>

            <aside className="side">
              <section className="card card-pad-lg stack" aria-labelledby="ref-heading">
                <h2 id="ref-heading" className="h-section">Referensi</h2>
                <p className="hint" style={{ marginTop: -4 }}>Upload gambar dan/atau tempel link.</p>
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
