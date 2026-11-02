// /tim/audit — admin: semua perubahan di semua task (ditulis otomatis oleh database, tidak bisa diubah
// siapa pun) dan daftar task terhapus yang bisa dipulihkan.

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { RotateCcw, Search } from "lucide-react";
import * as actions from "../../data/taskActions";
import { ACTION_LABEL, describeEntry } from "../../lib/changes";
import { fmtDateTime } from "../../lib/dates";
import { Avatar, useAction } from "../../components/ui";

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

          <section className="card audit-list" aria-label="Daftar perubahan">
            {entries === null && <p className="column-empty" style={{ margin: 12 }}>Memuat…</p>}
            {entries !== null && filtered.length === 0 && <p className="column-empty" style={{ margin: 12 }}>Tidak ada perubahan yang cocok.</p>}
            {filtered.map((h) => {
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
          <p className="hint">Riwayat ditulis otomatis oleh database dan tidak bisa diubah atau dihapus siapa pun, termasuk admin. Menampilkan 500 perubahan terbaru.</p>
        </>
      ) : (
        <section className="card audit-list" aria-label="Task terhapus">
          {deleted.length === 0 && <p className="column-empty" style={{ margin: 12 }}>Tidak ada task terhapus.</p>}
          {deleted.map((t) => (
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
      )}
    </>
  );
}
