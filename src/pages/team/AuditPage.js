// /tim/audit — admin: semua perubahan di semua task (ditulis otomatis oleh database, tidak bisa diubah
// siapa pun) dan daftar task terhapus yang bisa dipulihkan.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { RotateCcw, Search } from "lucide-react";
import * as actions from "../../data/taskActions";
import { ACTION_LABEL, describeEntry } from "../../lib/changes";
import { fmtDateTime } from "../../lib/dates";
import { Avatar, Pager, useAction } from "../../components/ui";

// Daftar perubahan dan task terhapus ditampilkan 30 baris per halaman.
const PAGE_SIZE = 30;
const pageOf = (list, page) => {
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const p = Math.min(page, pages - 1);
  return { page: p, pages, rows: list.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE) };
};

const RANGES = [
  ["7", "7 hari terakhir"],
  ["30", "30 hari terakhir"],
  ["all", "Semua"],
];

// Perubahan yang patut diperhatikan admin (mis. tangan iseng).
function flagOf(h) {
  if (h.action === "dihapus") return "Hapus";
  const due = h.changes.find((c) => c.field === "due_date");
  if (due && due.before && due.after && due.after < due.before) return "Deadline dimajukan";
  if (h.action === "diubah" && h.changes.some((c) => c.field === "pic")) return "PIC diganti";
  if (h.changes.some((c) => c.field === "result_links" && (c.before || []).length > (c.after || []).length)) return "Link hasil dihapus";
  return null;
}

export default function AuditPage() {
  const { allTasks, allMembers, colorOf, showToast } = useOutletContext();
  const navigate = useNavigate();
  const [run, busy] = useAction(showToast);
  const [view, setView] = useState("log");
  const [entries, setEntries] = useState(null);
  const [q, setQ] = useState("");
  const [actor, setActor] = useState("all");
  const [action, setAction] = useState("all");
  const [range, setRange] = useState("7");
  const [logPage, setLogPage] = useState(0);
  const [deletedPage, setDeletedPage] = useState(0);
  const listRef = useRef(null);
  // Filter berubah: kembali ke halaman 1.
  useEffect(() => setLogPage(0), [q, actor, action, range]);
  const goPage = (setter) => (n) => {
    setter(n);
    listRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  // Ambil ulang setiap kali ada task yang berubah (riwayat baru ditulis database).
  const version = useMemo(() => allTasks.reduce((m, t) => (t.updatedAt > m ? t.updatedAt : m), ""), [allTasks]);
  useEffect(() => {
    let alive = true;
    actions.listAllHistory(500).then((list) => alive && setEntries(list)).catch((e) => {
      if (!alive) return;
      setEntries([]);
      showToast(e.message, "error");
    });
    return () => {
      alive = false;
    };
  }, [version, showToast]);

  const deleted = allTasks.filter((t) => t.deletedAt).sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
  const nameOfEmail = (email) => allMembers.find((m) => m.email === email)?.name || email || "-";

  const actors = useMemo(() => [...new Set((entries || []).map((h) => h.actorName))].sort(), [entries]);
  const actionsPresent = useMemo(() => [...new Set((entries || []).map((h) => h.action))], [entries]);
  const filtered = useMemo(() => {
    const since = range === "all" ? 0 : Date.now() - Number(range) * 86400000;
    const query = q.trim().toLowerCase();
    return (entries || []).filter(
      (h) =>
        new Date(h.createdAt).getTime() >= since &&
        (actor === "all" || h.actorName === actor) &&
        (action === "all" || h.action === action) &&
        (!query || h.taskTitle.toLowerCase().includes(query))
    );
  }, [entries, q, actor, action, range]);
  const log = pageOf(filtered, logPage);
  const del = pageOf(deleted, deletedPage);

  return (
    <>
      <div className="segmented" role="group" aria-label="Bagian audit" style={{ alignSelf: "flex-start" }}>
        <button type="button" aria-pressed={view === "log"} onClick={() => setView("log")}>Semua perubahan</button>
        <button type="button" aria-pressed={view === "deleted"} onClick={() => setView("deleted")}>
          Task terhapus{deleted.length ? ` (${deleted.length})` : ""}
        </button>
      </div>

      {view === "log" ? (
        <>
          <div className="filter-bar">
            <label className="input row" style={{ flex: "1 1 260px", gap: 8, color: "var(--text-muted)", flexWrap: "nowrap" }}>
              <Search size={16} aria-hidden="true" />
              <span className="sr-only">Cari judul task</span>
              <input type="search" placeholder="Cari judul task" value={q} onChange={(e) => setQ(e.target.value)} style={{ border: 0, outline: "none", flex: 1, minWidth: 0, background: "transparent", color: "var(--text)" }} />
            </label>
            <select className="select" aria-label="Pelaku" value={actor} onChange={(e) => setActor(e.target.value)}>
              <option value="all">Semua pelaku</option>
              {actors.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <select className="select" aria-label="Jenis aksi" value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="all">Semua aksi</option>
              {actionsPresent.map((a) => <option key={a} value={a}>{ACTION_LABEL[a] || a}</option>)}
            </select>
            <select className="select" aria-label="Rentang waktu" value={range} onChange={(e) => setRange(e.target.value)}>
              {RANGES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </div>

          <section className="card audit-list" aria-label="Daftar perubahan" ref={listRef}>
            {entries === null && <p className="column-empty" style={{ margin: 12 }}>Memuat…</p>}
            {entries !== null && filtered.length === 0 && <p className="column-empty" style={{ margin: 12 }}>Tidak ada perubahan yang cocok.</p>}
            {log.rows.map((h) => {
              const d = describeEntry(h);
              const flag = flagOf(h);
              return (
                <div key={h.id} className={`audit-row ${flag ? "flag" : ""}`}>
                  <span className="when">{fmtDateTime(h.createdAt)}</span>
                  <span className="who"><Avatar name={h.actorName} color={colorOf(h.actorName)} size={22} />{h.actorName}</span>
                  <span className="what">
                    {d.what}{" "}
                    {h.taskDeleted ? (
                      <strong>{h.taskTitle} (terhapus)</strong>
                    ) : (
                      <button type="button" className="task-link" onClick={() => navigate(`/tim/task/${h.taskId}`)}>{h.taskTitle}</button>
                    )}
                    {d.details && <span className="small muted" style={{ display: "block" }}>{d.details}</span>}
                  </span>
                  {flag && <span className="badge badge-late" style={{ alignSelf: "center" }}>{flag}</span>}
                </div>
              );
            })}
          </section>
          {log.pages > 1 && <Pager label="daftar perubahan" unit="baris" pageSize={PAGE_SIZE} page={log.page} pages={log.pages} total={filtered.length} onPage={goPage(setLogPage)} />}
          <p className="hint">Riwayat ditulis otomatis oleh database dan tidak bisa diubah atau dihapus siapa pun, termasuk admin. Menampilkan 500 perubahan terbaru.</p>
        </>
      ) : (
        <>
        <section className="card audit-list" aria-label="Task terhapus" ref={listRef}>
          {deleted.length === 0 && <p className="column-empty" style={{ margin: 12 }}>Tidak ada task terhapus.</p>}
          {del.rows.map((t) => (
            <div key={t.id} className="deleted-row">
              <span className="grow">
                <strong>{t.title}</strong> <span className="muted">({t.division})</span>
                <span className="small muted" style={{ display: "block" }}>Dihapus {nameOfEmail(t.deletedBy)} · {fmtDateTime(t.deletedAt)} · terakhir di kolom {t.status === "on_progress" ? "On Progress" : t.status[0].toUpperCase() + t.status.slice(1)}</span>
              </span>
              <button type="button" className="btn btn-outline" disabled={busy} onClick={() => run(() => actions.restoreTask(t.id), `"${t.title}" dipulihkan ke board.`)}>
                <RotateCcw size={16} aria-hidden="true" /> Pulihkan
              </button>
            </div>
          ))}
        </section>
        {del.pages > 1 && <Pager label="task terhapus" unit="task" pageSize={PAGE_SIZE} page={del.page} pages={del.pages} total={deleted.length} onPage={goPage(setDeletedPage)} />}
        </>
      )}
    </>
  );
}
