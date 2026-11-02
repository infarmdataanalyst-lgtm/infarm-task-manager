// /tim dan /tim/task/:id — board Kanban: Request → On Progress → Delay → Finish.
// Kartu bisa digeser maju/mundur (desktop) atau lewat "Pindah ke…" (desktop & HP).

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { STATUS, STATUSES } from "../../config";
import * as actions from "../../data/taskActions";
import { canLeaveRequest, involves, notPicMessage } from "../../data/taskModel";
import { daysBetween, isOverdue, parseDay, today } from "../../lib/dates";
import { Avatar, useAction, useNow } from "../../components/ui";
import TaskCard from "./TaskCard";
import TaskDetail from "./TaskDetail";
import MoveDialog from "./MoveDialog";

const FINISH_WINDOW_DAYS = 30;

// Pencarian: judul, brief, nama requester, dan divisi (tidak peka huruf besar/kecil, cocok sebagian).
const matchesQuery = (t, q) => [t.title, t.description, t.requesterName, t.division].some((v) => (v || "").toLowerCase().includes(q));

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
  const { tasks, showToast, query, member, designers, colorOf, isNew, markRead } = useOutletContext();
  const location = useLocation();
  const kanbanRef = useRef(null);
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

  // Task Finish lama yang tidak dimuat board: dari pencarian database dan dari link langsung.
  const [archive, setArchive] = useState([]);
  const [linked, setLinked] = useState(null); // { id, task|null }
  const q = query.trim().toLowerCase();
  useEffect(() => {
    if (q.length < 2) {
      setArchive([]);
      return undefined;
    }
    let alive = true;
    const timer = setTimeout(() => {
      actions.searchTasks(q).then((list) => alive && setArchive(list)).catch(() => alive && setArchive([]));
    }, 350);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [q]);
  const loadedIds = useMemo(() => new Set(tasks.map((t) => t.id)), [tasks]);
  const archiveHits = useMemo(() => archive.filter((t) => !loadedIds.has(t.id)), [archive, loadedIds]);
  const archiveIds = useMemo(() => new Set(archiveHits.map((t) => t.id)), [archiveHits]);

  const fromLoaded = id ? tasks.find((t) => t.id === id) || archiveHits.find((t) => t.id === id) : null;
  useEffect(() => {
    if (!id || fromLoaded || linked?.id === id) return undefined;
    let alive = true;
    actions.getTask(id).then((t) => alive && setLinked({ id, task: t && !t.deletedAt ? t : null })).catch(() => alive && setLinked({ id, task: null }));
    return () => {
      alive = false;
    };
  }, [id, fromLoaded, linked]);
  const selected = fromLoaded || (id && linked && linked.id === id ? linked.task : null);
  const notFound = !!id && !selected && !!linked && linked.id === id;

  // Membuka detail = akun ini sudah melihat task tersebut (badge "Baru" hilang untuk akun ini saja).
  useEffect(() => {
    if (selected) markRead(selected.id);
  }, [selected, markRead]);

  // Dari banner "Lihat": tampilkan kolom Request.
  const focusAt = location.state?.focus === "request" ? location.state.at : null;
  useEffect(() => {
    if (!focusAt) return;
    setActiveCol("request");
    kanbanRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusAt]);
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
    return [...tasks, ...archiveHits].filter(
      (t) =>
        (!mine || involves(t, member.name)) &&
        (pic === "all" || involves(t, pic)) &&
        matchesDue(t, due) &&
        (!q || matchesQuery(t, q))
    );
  }, [tasks, archiveHits, q, mine, member.name, pic, due]);

  const columns = STATUSES.map((s) => {
    let items = filtered.filter((t) => t.status === s);
    let hidden = 0;
    if (s === "finish") {
      items.sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt));
      // Saat mencari, semua hasil Finish ditampilkan (tidak dibatasi 30 hari).
      if (!showAllFinished && !q) {
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

  const assign = (t, name) => run(() => actions.assignPic(t.id, name), `PIC "${t.title}": ${name}. Task tetap di Request sampai ${name} memulainya.`);
  const start = (t) => run(() => actions.startTask(t.id), `"${t.title}" mulai dikerjakan. Waktu On Progress berjalan.`);

  // Geser kartu: pindah langsung bila tidak perlu isian; selain itu buka dialog dengan tujuan terpilih.
  const drop = (status) => {
    const t = tasks.find((x) => x.id === dragId);
    setDragId(null);
    setDropCol(null);
    if (!t || t.status === status) return;
    const leaving = t.status === "request" && status !== "request";
    if (leaving && t.pic && !canLeaveRequest(t, member)) return showToast(notPicMessage(t.pic), "error");
    const needsDialog = status === "finish" || status === "delay" || (leaving && !t.pic);
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

      <section aria-label="Kanban" className="kanban" ref={kanbanRef}>
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
                  isNew={isNew(t)}
                  fromArchive={archiveIds.has(t.id)}
                  now={now}
                  member={member}
                  designers={designers}
                  colorOf={colorOf}
                  busy={busy}
                  draggable={draggable}
                  dragging={dragId === t.id}
                  onDragStart={(task) => setDragId(task.id)}
                  onDragEnd={() => { setDragId(null); setDropCol(null); }}
                  onAssign={assign}
                  onStart={start}
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

      {notFound && (
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
          member={member}
          designers={designers}
          colorOf={colorOf}
          run={run}
          busy={busy}
          onClose={closeDetail}
          onAssign={assign}
          onStart={start}
          onMove={(task, target) => setMoving({ task, target })}
        />
      )}
      {moving && (
        <MoveDialog
          key={moving.task.id}
          task={tasks.find((t) => t.id === moving.task.id) || moving.task}
          initialTarget={moving.target}
          designers={designers}
          member={member}
          run={run}
          busy={busy}
          onClose={() => setMoving(null)}
          onDone={() => setMoving(null)}
        />
      )}
    </>
  );
}
