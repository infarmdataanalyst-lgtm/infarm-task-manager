// /tim dan /tim/task/:id — board Kanban: Request → On Progress → Delay → Finish.
// Kartu bisa digeser maju/mundur (desktop) atau lewat "Pindah ke…" (desktop & HP).

import React, { useCallback, useMemo, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { STATUS, STATUSES } from "../../config";
import * as actions from "../../data/taskActions";
import { involves } from "../../data/taskModel";
import { daysBetween, isOverdue, parseDay, today } from "../../lib/dates";
import { Avatar, useAction, useNow } from "../../components/ui";
import TaskCard from "./TaskCard";
import TaskDetail from "./TaskDetail";
import MoveDialog from "./MoveDialog";

const FINISH_WINDOW_DAYS = 30;

const byDue = (a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999") || new Date(a.createdAt) - new Date(b.createdAt);

function matchesDue(task, due) {
  if (due === "all") return true;
  if (due === "overdue") return isOverdue(task);
  if (!task.dueDate || task.status === "finish") return false;
  const diff = daysBetween(today(), parseDay(task.dueDate));
  return due === "today" ? diff === 0 : diff >= 0 && diff <= 7;
}

const canDrag = () => typeof window !== "undefined" && window.matchMedia("(min-width: 721px) and (pointer: fine)").matches;

export default function BoardPage() {
  const { tasks, showToast, query, member, designers, colorOf } = useOutletContext();
  const { id } = useParams();
  const navigate = useNavigate();
  const [run, busy] = useAction(showToast);
  const now = useNow();
  const [mine, setMine] = useState(false);
  const [pic, setPic] = useState("all");
  const [due, setDue] = useState("all");
  const [activeCol, setActiveCol] = useState("request");
  const [showAllFinished, setShowAllFinished] = useState(false);
  const [moving, setMoving] = useState(null); // { task, target }
  const [dragId, setDragId] = useState(null);
  const [dropCol, setDropCol] = useState(null);
  const draggable = useMemo(canDrag, []);

  const selected = id ? tasks.find((t) => t.id === id) : null;
  const closeDetail = useCallback(() => navigate("/tim"), [navigate]);
  const isDesigner = member.role === "designer";

  // Angka ringkas selalu dari SEMUA task (tidak terpengaruh filter).
  const recentFinished = (t) => t.finishedAt && daysBetween(t.finishedAt, new Date()) < FINISH_WINDOW_DAYS;
  const chips = [
    { key: "request", label: "Request", value: tasks.filter((t) => t.status === "request").length },
    { key: "on_progress", label: "On Progress", value: tasks.filter((t) => t.status === "on_progress").length },
    { key: "delay", label: "Delay", value: tasks.filter((t) => t.status === "delay").length },
    { key: "late", label: "Terlambat", value: tasks.filter(isOverdue).length },
    { key: "finish", label: `Selesai ${FINISH_WINDOW_DAYS} hari`, value: tasks.filter((t) => t.status === "finish" && recentFinished(t)).length },
  ];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter(
      (t) =>
        (!mine || involves(t, member.name)) &&
        (pic === "all" || involves(t, pic)) &&
        matchesDue(t, due) &&
        (!q || t.title.toLowerCase().includes(q))
    );
  }, [tasks, query, mine, member.name, pic, due]);

  const columns = STATUSES.map((s) => {
    let items = filtered.filter((t) => t.status === s);
    let hidden = 0;
    if (s === "finish") {
      items.sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt));
      if (!showAllFinished) {
        const recent = items.filter(recentFinished);
        hidden = items.length - recent.length;
        items = recent;
      }
    } else {
      items.sort(byDue);
    }
    return { status: s, items, hidden };
  });

  const filtersActive = query || mine || pic !== "all" || due !== "all";

  const take = (t, name) => run(() => actions.takeTask(t.id, name), `"${t.title}" diambil ${name}. Waktu kerja mulai berjalan.`);

  // Geser kartu: pindah langsung bila tidak perlu isian; selain itu buka dialog dengan tujuan terpilih.
  const drop = (status) => {
    const t = tasks.find((x) => x.id === dragId);
    setDragId(null);
    setDropCol(null);
    if (!t || t.status === status) return;
    const needsDialog = status === "finish" || status === "delay" || (!t.pic && status !== "request");
    if (needsDialog) setMoving({ task: t, target: status });
    else run(() => actions.moveTask(t.id, status), `Dipindah ke ${STATUS[status].label}.`);
  };

  return (
    <>
      <section aria-label="Ringkasan" className="chips">
        {chips.map((c) => (
          <div key={c.key} className={`chip ${c.key === "late" ? "late" : ""}`}>
            <span className={`dot dot-${c.key}`} />
            <span className="label">{c.label}</span>
            <strong>{c.value}</strong>
          </div>
        ))}
      </section>

      <div className="filter-bar">
        {isDesigner && (
          <div className="segmented" role="group" aria-label="Tampilkan">
            <button type="button" aria-pressed={mine} onClick={() => setMine(true)}>Tugas saya</button>
            <button type="button" aria-pressed={!mine} onClick={() => setMine(false)}>Semua</button>
          </div>
        )}
        <div className="pills scroll-row" role="group" aria-label="Filter PIC">
          {designers.map((d) => {
            const count = tasks.filter((t) => t.status !== "finish" && involves(t, d.name)).length;
            return (
              <button key={d.email} type="button" className="pill pill-avatar" aria-pressed={pic === d.name} onClick={() => setPic(pic === d.name ? "all" : d.name)}>
                <Avatar name={d.name} color={d.color} size={24} /> {d.name} ({count})
              </button>
            );
          })}
        </div>
        <select className="select" aria-label="Filter deadline" value={due} onChange={(e) => setDue(e.target.value)}>
          <option value="all">Semua deadline</option>
          <option value="today">Deadline hari ini</option>
          <option value="week">7 hari ke depan</option>
          <option value="overdue">Terlambat</option>
        </select>
        {filtersActive && (
          <button type="button" className="btn btn-text" onClick={() => { setMine(false); setPic("all"); setDue("all"); }}>
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
          <div
            key={c.status}
            className={`column column-${c.status} ${activeCol === c.status ? "active" : ""} ${dropCol === c.status ? "drop-target" : ""}`}
            onDragOver={(e) => {
              if (!dragId) return;
              e.preventDefault();
              if (dropCol !== c.status) setDropCol(c.status);
            }}
            onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget) && setDropCol(null)}
            onDrop={(e) => {
              e.preventDefault();
              drop(c.status);
            }}
          >
            <div className="column-head">
              <span className={`dot dot-${c.status}`} style={{ width: 10, height: 10, borderRadius: 9999, display: "inline-block" }} />
              <span style={{ fontWeight: 700 }}>{STATUS[c.status].label}</span>
              <span className="small muted">{STATUS[c.status].note}</span>
              <span className="count">{c.items.length}</span>
            </div>
            <div className="column-body">
              {c.items.length === 0 && <p className="column-empty">{filtersActive ? "Tidak ada yang cocok dengan filter." : "Kosong"}</p>}
              {c.items.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  now={now}
                  designers={designers}
                  colorOf={colorOf}
                  busy={busy}
                  draggable={draggable}
                  dragging={dragId === t.id}
                  onDragStart={(task) => setDragId(task.id)}
                  onDragEnd={() => { setDragId(null); setDropCol(null); }}
                  onTake={take}
                  onMove={(task) => setMoving({ task })}
                />
              ))}
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
      {selected && !moving && (
        <TaskDetail
          task={selected}
          now={now}
          designers={designers}
          colorOf={colorOf}
          run={run}
          busy={busy}
          onClose={closeDetail}
          onTake={take}
          onMove={(task, target) => setMoving({ task, target })}
        />
      )}
      {moving && (
        <MoveDialog
          key={moving.task.id}
          task={tasks.find((t) => t.id === moving.task.id) || moving.task}
          initialTarget={moving.target}
          designers={designers}
          run={run}
          busy={busy}
          onClose={() => setMoving(null)}
          onDone={() => setMoving(null)}
        />
      )}
    </>
  );
}
