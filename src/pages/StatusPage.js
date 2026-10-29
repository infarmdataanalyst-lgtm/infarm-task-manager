// / — halaman publik: status semua request, bisa dilihat siapa saja tanpa login.

import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, ImageIcon, Plus, Search } from "lucide-react";
import { DIVISIONS, STATUS, STATUSES } from "../config";
import { useTasks } from "../data/useTasks";
import { daysLate, fmtDay, fmtShort, isOverdue } from "../lib/dates";
import { AppHeader, LocalModeBanner, ReferenceList, StatusBadge, Stepper, referenceSummary } from "../components/ui";

const PAGE_SIZE = 20;

const statusNote = (t) => {
  if (t.status === "request") return "Sudah masuk. Menunggu diambil Denny atau Arum.";
  if (t.status === "todo") return `Diambil ${t.pic}, belum mulai`;
  if (t.status === "on_progress") {
    const done = t.checklist.filter((c) => c.done).length;
    const parts = [`Dikerjakan ${t.pic}`];
    if (t.checklist.length) parts.push(`checklist ${done} dari ${t.checklist.length}`);
    if (isOverdue(t)) parts.push(`lewat deadline ${daysLate(t)} hari`);
    return parts.join(" · ");
  }
  return `Selesai ${fmtShort(t.finishedAt)} oleh ${t.pic}`;
};

export default function StatusPage() {
  const { tasks, loading } = useTasks();
  const [query, setQuery] = useState("");
  const [division, setDivision] = useState("all");
  const [status, setStatus] = useState("all");
  const [openId, setOpenId] = useState(null);
  const [limit, setLimit] = useState(PAGE_SIZE);

  // Pencarian & divisi dulu, supaya angka di tab status ikut menyesuaikan.
  const matched = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks
      .filter((t) => division === "all" || t.division === division)
      .filter((t) => !q || [t.title, t.requesterName, t.category, t.pic].some((v) => v?.toLowerCase().includes(q)))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [tasks, query, division]);

  const visible = status === "all" ? matched : matched.filter((t) => t.status === status);
  const count = (s) => matched.filter((t) => t.status === s).length;

  return (
    <>
      <AppHeader title="Status request desain" subtitle="Semua request ke Tim Desain. Cek apakah request kamu sudah masuk dan sampai mana progresnya.">
        <Link to="/request" className="btn btn-on-green btn-cta" aria-label="Buat request baru">
          <Plus size={18} aria-hidden="true" />
          <span className="btn-label">Buat request baru</span>
        </Link>
      </AppHeader>

      <main className="container container-narrow page">
        <LocalModeBanner />
        <div className="row" style={{ gap: 10 }}>
          <label className="search">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">Cari request</span>
            <input type="search" placeholder="Cari nama kamu atau judul request" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <label className="row small muted" style={{ gap: 6 }}>
            Divisi
            <select className="select" style={{ width: "auto" }} value={division} onChange={(e) => setDivision(e.target.value)}>
              <option value="all">Semua divisi</option>
              {DIVISIONS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </label>
        </div>

        <nav className="pills" aria-label="Filter status">
          <button type="button" className="pill" aria-pressed={status === "all"} onClick={() => setStatus("all")}>
            Semua <span className="count">{matched.length}</span>
          </button>
          {STATUSES.map((s) => (
            <button key={s} type="button" className="pill" aria-pressed={status === s} onClick={() => setStatus(s)}>
              {STATUS[s].label} <span className="count">{count(s)}</span>
            </button>
          ))}
        </nav>
        {query.trim() && <p className="small muted" style={{ marginTop: -6 }}>{visible.length} request cocok dengan "{query.trim()}"</p>}

        <section aria-label="Daftar request" className="stack" style={{ gap: 10 }}>
          {loading && <p className="muted">Memuat…</p>}
          {!loading && visible.length === 0 && (
            <div className="card card-pad-lg" style={{ textAlign: "center" }}>
              <p style={{ fontWeight: 600 }}>{tasks.length ? "Tidak ada request yang cocok." : "Belum ada request."}</p>
              <p className="muted">Request baru akan muncul di sini setelah dikirim lewat form.</p>
            </div>
          )}
          {visible.slice(0, limit).map((t) => {
            const open = openId === t.id;
            return (
              <article key={t.id} className={`card req-card ${open ? "open" : ""}`}>
                <div className="req-main">
                  <div className="req-title">
                    <h2>{t.title}</h2>
                    <p className="small muted">{t.category} · {t.requesterName} ({t.division}) · dikirim {fmtShort(t.createdAt)}</p>
                  </div>
                  <div className="req-progress">
                    <Stepper status={t.status} showLabels={false} />
                    <div className="row" style={{ gap: 6 }}>
                      <StatusBadge status={t.status} />
                      <span className="small" style={{ color: "var(--zinc-700)" }}>{statusNote(t)}</span>
                    </div>
                  </div>
                  <div className="req-due">
                    <p className="small muted">Deadline</p>
                    <p style={{ fontWeight: 600, color: isOverdue(t) ? "var(--rose-700)" : undefined }}>{fmtDay(t.dueDate)}</p>
                  </div>
                  <div className="req-actions">
                    {t.status === "finish" &&
                      t.resultLinks.map((l, i) => (
                        <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                          <ExternalLink size={16} aria-hidden="true" />
                          {t.resultLinks.length > 1 ? `Hasil desain ${i + 1}` : "Buka hasil desain"}
                        </a>
                      ))}
                    <button type="button" className="btn btn-secondary btn-sm" aria-expanded={open} onClick={() => setOpenId(open ? null : t.id)}>
                      <ImageIcon size={16} aria-hidden="true" />
                      {open ? "Sembunyikan referensi" : `Referensi: ${referenceSummary(t)}`}
                    </button>
                  </div>
                </div>
                {open && (
                  <div className="req-detail">
                    <div>
                      <p className="eyebrow">Referensi yang diterima tim desain</p>
                      <ReferenceList task={t} />
                    </div>
                    <div>
                      <p className="eyebrow">Brief</p>
                      <p style={{ color: "var(--zinc-700)", whiteSpace: "pre-line" }}>{t.description || "Tidak ada brief."}</p>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
          {visible.length > limit && (
            <button type="button" className="btn btn-secondary" style={{ alignSelf: "center", minHeight: 44 }} onClick={() => setLimit(limit + PAGE_SIZE)}>
              Muat {Math.min(PAGE_SIZE, visible.length - limit)} request lainnya
            </button>
          )}
        </section>
      </main>
    </>
  );
}
