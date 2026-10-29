// /tim dan /tim/task/:id — board Kanban tim desain.

import React, { useCallback, useMemo, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Search } from "lucide-react";
import { DESIGNERS, STATUS, STATUSES } from "../../config";
import * as actions from "../../data/taskActions";
import { involves } from "../../data/taskModel";
import { daysBetween, isOverdue, parseDay, today } from "../../lib/dates";
import { Avatar, useAction } from "../../components/ui";
import TaskCard from "./TaskCard";
import TaskDetail from "./TaskDetail";
import FinishDialog from "./FinishDialog";

const FINISH_WINDOW_DAYS = 30;

const COLUMN_NOTE = { request: "belum ada PIC", finish: `${FINISH_WINDOW_DAYS} hari terakhir` };

const byDue = (a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999");

function matchesDue(task, due) {
  if (due === "all") return true;
  if (due === "overdue") return isOverdue(task);
  if (!task.dueDate || task.status === "finish") return false;
  const diff = daysBetween(today(), parseDay(task.dueDate));
  return due === "today" ? diff === 0 : diff >= 0 && diff <= 7;
}

export default function BoardPage() {
  const { tasks, showToast } = useOutletContext();
  const { id } = useParams();
  const navigate = useNavigate();
  const [run, busy] = useAction(showToast);
  const [query, setQuery] = useState("");
  const [pic, setPic] = useState("all");
  const [due, setDue] = useState("all");
  const [activeCol, setActiveCol] = useState("request");
  const [showAllFinished, setShowAllFinished] = useState(false);
  const [finishing, setFinishing] = useState(null);

  const selected = id ? tasks.find((t) => t.id === id) : null;
  const closeDetail = useCallback(() => navigate("/tim"), [navigate]);

  // Statistik selalu dari SEMUA task (tidak terpengaruh filter), supaya angkanya konsisten.
  const stats = useMemo(() => {
    const recentFinished = tasks.filter((t) => t.status === "finish" && t.finishedAt && daysBetween(t.finishedAt, new Date()) < FINISH_WINDOW_DAYS);
    return [
      { label: "Request baru", value: tasks.filter((t) => t.status === "request").length, hint: "menunggu diambil", color: "var(--amber-800)" },
      { label: "Todo", value: tasks.filter((t) => t.status === "todo").length, hint: "sudah ada PIC" },
      { label: "On Progress", value: tasks.filter((t) => t.status === "on_progress").length, hint: "sedang dikerjakan", color: "var(--brand-soil)" },
      { label: "Terlambat", value: tasks.filter(isOverdue).length, hint: "lewat deadline", color: "var(--rose-700)" },
      { label: `Selesai ${FINISH_WINDOW_DAYS} hari`, value: recentFinished.length, hint: "dengan link hasil", color: "var(--brand-primary)" },
    ];
  }, [tasks]);

  // Beban kerja: task aktif di mana desainer ini PIC atau punya item checklist yang belum selesai.
  const workload = DESIGNERS.map((d) => ({
    ...d,
    active: tasks.filter((t) => involves(t, d.name) && (t.status === "todo" || t.status === "on_progress")).length,
  }));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter(
      (t) =>
        (pic === "all" || involves(t, pic)) &&
        matchesDue(t, due) &&
        (!q || [t.title, t.requesterName, t.division, t.category, t.pic].some((v) => v?.toLowerCase().includes(q)))
    );
  }, [tasks, query, pic, due]);

  const columns = STATUSES.map((s) => {
    let items = filtered.filter((t) => t.status === s);
    let hidden = 0;
    if (s === "finish") {
      items.sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt));
      if (!showAllFinished) {
        const recent = items.filter((t) => t.finishedAt && daysBetween(t.finishedAt, new Date()) < FINISH_WINDOW_DAYS);
        hidden = items.length - recent.length;
        items = recent;
      }
    } else {
      items.sort(byDue);
    }
    return { status: s, items, hidden };
  });

  const filtersActive = query || pic !== "all" || due !== "all";

  const cardHandlers = {
    busy,
    onAssign: (t, name) => run(() => actions.assignTask(t.id, name), `"${t.title}" diambil ${name}.`),
    onStart: (t) => run(() => actions.startTask(t.id)),
    onFinish: (t) => setFinishing(t),
    onRevise: (t) => run(() => actions.reviseTask(t.id), "Task kembali ke On Progress untuk revisi."),
  };

  return (
    <>
      <section aria-label="Ringkasan" className="stats">
        {stats.map((s) => (
          <div key={s.label} className="card stat">
            <p className="small muted">{s.label}</p>
            <p className="stat-value" style={{ color: s.color }}>{s.value}</p>
            <p className="small muted">{s.hint}</p>
          </div>
        ))}
      </section>

      <section aria-label="Beban kerja" className="workload">
        {workload.map((d) => (
          <button key={d.name} type="button" className="card workload-item" style={{ textAlign: "left", borderColor: pic === d.name ? d.color : undefined }} aria-pressed={pic === d.name} onClick={() => setPic(pic === d.name ? "all" : d.name)}>
            <Avatar name={d.name} size={32} />
            <span>
              <span style={{ display: "block", fontWeight: 600 }}>{d.name}</span>
              <span className="small muted">{d.active} task aktif</span>
            </span>
          </button>
        ))}
      </section>

      <div className="row filter-bar" style={{ gap: 10 }}>
        <label className="search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Cari task</span>
          <input type="search" placeholder="Cari judul, requester, atau PIC" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="pills" role="group" aria-label="Filter PIC">
          <button type="button" className="pill" aria-pressed={pic === "all"} onClick={() => setPic("all")}>Semua</button>
          {DESIGNERS.map((d) => (
            <button key={d.name} type="button" className="pill" aria-pressed={pic === d.name} onClick={() => setPic(d.name)}>{d.name}</button>
          ))}
        </div>
        <label className="row small muted filter-select" style={{ gap: 6 }}>
          <span className="hide-mobile">Deadline</span>
          <select className="select" aria-label="Filter deadline" value={due} onChange={(e) => setDue(e.target.value)}>
            <option value="all">Semua deadline</option>
            <option value="today">Hari ini</option>
            <option value="week">7 hari ke depan</option>
            <option value="overdue">Terlambat</option>
          </select>
        </label>
        {filtersActive && (
          <button type="button" className="btn btn-text" onClick={() => { setQuery(""); setPic("all"); setDue("all"); }}>
            Reset filter
          </button>
        )}
      </div>

      <nav className="col-tabs" aria-label="Kolom">
        {columns.map((c) => (
          <button key={c.status} type="button" className="pill" aria-pressed={activeCol === c.status} onClick={() => setActiveCol(c.status)}>
            {STATUS[c.status].label} <span className="count">{c.items.length}</span>
          </button>
        ))}
      </nav>

      <section aria-label="Kanban" className="kanban">
        {columns.map((c) => (
          <div key={c.status} className={`card column ${activeCol === c.status ? "active" : ""}`}>
            <div className="column-head">
              <span>
                <span style={{ fontWeight: 600 }}>{STATUS[c.status].label}</span>{" "}
                {COLUMN_NOTE[c.status] && <span className="small muted">{COLUMN_NOTE[c.status]}</span>}
              </span>
              <span style={{ fontWeight: 600, color: "var(--zinc-700)" }}>{c.items.length}</span>
            </div>
            <div className="column-body">
              {c.items.length === 0 && <p className="column-empty">{filtersActive ? "Tidak ada yang cocok dengan filter." : "Kosong"}</p>}
              {c.items.map((t) => <TaskCard key={t.id} task={t} {...cardHandlers} />)}
              {c.status === "finish" && (c.hidden > 0 || showAllFinished) && (
                <button type="button" className="btn btn-text" onClick={() => setShowAllFinished(!showAllFinished)}>
                  {showAllFinished ? `Tampilkan ${FINISH_WINDOW_DAYS} hari terakhir saja` : `Lihat ${c.hidden} task selesai lainnya`}
                </button>
              )}
            </div>
          </div>
        ))}
      </section>

      {id && !selected && (
        <div className="modal-wrap">
          <div className="modal" role="alertdialog" aria-labelledby="nf-title">
            <h2 id="nf-title" className="h-section">Task tidak ditemukan</h2>
            <p>Task ini mungkin sudah dihapus.</p>
            <div className="modal-actions"><button type="button" className="btn btn-primary" onClick={closeDetail}>Kembali ke board</button></div>
          </div>
        </div>
      )}
      {selected && <TaskDetail task={selected} run={run} busy={busy} onClose={closeDetail} onFinish={setFinishing} />}
      {finishing && (
        <FinishDialog
          key={finishing.id}
          task={tasks.find((t) => t.id === finishing.id) || finishing}
          run={run}
          busy={busy}
          onClose={() => setFinishing(null)}
          onDone={() => setFinishing(null)}
        />
      )}
    </>
  );
}
