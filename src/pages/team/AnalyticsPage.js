// /tim/analitik — ringkasan kinerja per periode dan per desainer.
// Tahap 2 v8: perbandingan per orang dengan minggu/bulan lalu (lihat mockup).

import React, { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { CATEGORIES, DIVISIONS } from "../../config";
import { involves } from "../../data/taskModel";
import { finishedOnTime, fmtShort, inRange, isOverdue, periodRange, toYMD } from "../../lib/dates";
import { fmtDuration, taskWorkMinutes } from "../../lib/worktime";
import { Avatar } from "../../components/ui";

const PERIODS = [
  ["last30", "30 hari terakhir"],
  ["this_month", "Bulan ini"],
  ["last_month", "Bulan lalu"],
  ["custom", "Pilih tanggal"],
];

// Rata-rata waktu kerja (jam kerja) per task selesai.
const avgWork = (list) => (list.length ? fmtDuration(Math.round(list.reduce((s, t) => s + taskWorkMinutes(t), 0) / list.length)) : "-");

const bars = (entries) => {
  const max = Math.max(1, ...entries.map((e) => e[1]));
  return entries.map(([label, value]) => ({ label, value, pct: `${Math.round((value / max) * 100)}%` }));
};

export default function AnalyticsPage() {
  const { tasks, designers } = useOutletContext();
  const [period, setPeriod] = useState("last30");
  const [custom, setCustom] = useState({ from: toYMD(new Date(Date.now() - 29 * 86400000)), to: toYMD(new Date()) });

  const range = useMemo(() => periodRange(period, custom), [period, custom]);

  const data = useMemo(() => {
    const received = tasks.filter((t) => inRange(t.createdAt, range));
    const finished = tasks.filter((t) => t.status === "finish" && inRange(t.finishedAt, range));
    const onTime = finished.filter(finishedOnTime).length;
    const count = (key, values) => {
      const counts = values.map((v) => [v, received.filter((t) => t[key] === v).length]);
      return bars(counts.filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]));
    };
    return {
      kpis: [
        { label: "Request masuk", value: received.length, hint: `${tasks.filter((t) => t.status === "request").length} masih menunggu diambil` },
        { label: "Task selesai", value: finished.length, hint: "semua dengan link hasil", color: "var(--brand-primary)" },
        {
          label: "Selesai tepat waktu",
          value: finished.length ? `${onTime} dari ${finished.length}` : "-",
          hint: finished.length ? `${Math.round((onTime / finished.length) * 100)}%` : "belum ada task selesai",
          color: "var(--brand-primary)",
        },
        { label: "Rata-rata waktu kerja", value: avgWork(finished), hint: "jam kerja Sen–Jum 08–17 per task" },
        { label: "Sedang terlambat", value: tasks.filter(isOverdue).length, hint: "task aktif lewat deadline (saat ini)", color: "var(--rose-700)" },
      ],
      // Task bersama dihitung untuk PIC dan setiap pengerja checklist.
      pics: designers.map((d) => {
        const mine = tasks.filter((t) => t.pic === d.name || t.checklist.some((c) => c.assignee === d.name));
        const prog = mine.filter((t) => t.status === "on_progress" && involves(t, d.name)).length;
        const delay = mine.filter((t) => t.status === "delay" && involves(t, d.name)).length;
        const done = finished.filter((t) => mine.includes(t));
        return {
          ...d,
          active: prog + delay,
          note: `On Progress ${prog} · Delay ${delay}`,
          stats: [
            { label: "Selesai", value: done.length, color: "var(--brand-primary)" },
            { label: "Tepat waktu", value: done.length ? `${done.filter(finishedOnTime).length}/${done.length}` : "-" },
            { label: "Terlambat", value: mine.filter(isOverdue).length, color: mine.some(isOverdue) ? "var(--rose-700)" : undefined },
            { label: "Rata-rata", value: avgWork(done) },
          ],
        };
      }),
      byCategory: count("category", CATEGORIES),
      byDivision: count("division", DIVISIONS),
    };
  }, [tasks, range, designers]);

  const maxActive = Math.max(1, ...data.pics.map((p) => p.active));

  return (
    <>
      <div className="row period-bar" style={{ gap: 8 }}>
        <span className="small muted hide-mobile">Periode:</span>
        <div className="pills scroll-row" role="group" aria-label="Periode">
          {PERIODS.map(([key, label]) => (
            <button key={key} type="button" className="pill" aria-pressed={period === key} onClick={() => setPeriod(key)}>{label}</button>
          ))}
        </div>
        {period === "custom" && (
          <span className="row" style={{ gap: 6 }}>
            <label className="sr-only" htmlFor="an-from">Dari tanggal</label>
            <input id="an-from" type="date" className="input" style={{ width: "auto" }} value={custom.from} max={custom.to} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
            <span className="muted">sampai</span>
            <label className="sr-only" htmlFor="an-to">Sampai tanggal</label>
            <input id="an-to" type="date" className="input" style={{ width: "auto" }} value={custom.to} min={custom.from} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
          </span>
        )}
      </div>
      <p className="small muted" style={{ marginTop: -10 }}>
        {fmtShort(range.from)} – {fmtShort(range.to)}. Request masuk dihitung dari tanggal kirim, task selesai dari tanggal pindah ke Finish.
      </p>

      <section aria-label="Ringkasan periode" className="stats">
        {data.kpis.map((k) => (
          <div key={k.label} className="card stat">
            <p className="small muted">{k.label}</p>
            <p className="stat-value" style={{ color: k.color }}>{k.value}</p>
            <p className="small muted">{k.hint}</p>
          </div>
        ))}
      </section>

      <section aria-label="Per desainer" className="grid-auto-340">
        {data.pics.map((p) => (
          <div key={p.name} className="card card-pad stack-lg">
            <div className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
              <Avatar name={p.name} color={p.color} size={32} />
              <div>
                <h2 className="h-section">{p.name}</h2>
                <p className="small muted">{p.active} task aktif · {p.note}</p>
              </div>
            </div>
            <div className="bar-track" aria-hidden="true"><div style={{ width: `${Math.round((p.active / maxActive) * 100)}%`, background: p.color }} /></div>
            <dl className="pic-stats">
              {p.stats.map((s) => (
                <div key={s.label}><dt>{s.label}</dt><dd style={{ color: s.color }}>{s.value}</dd></div>
              ))}
            </dl>
          </div>
        ))}
      </section>

      <section className="grid-auto-340">
        {[["Request per kategori", data.byCategory], ["Request per divisi", data.byDivision]].map(([title, rows]) => (
          <div key={title} className="card card-pad stack">
            <h2 className="h-card" style={{ marginBottom: 4 }}>{title}</h2>
            {rows.length === 0 && <p className="muted">Belum ada request di periode ini.</p>}
            {rows.map((r) => (
              <div key={r.label} className="bar-row">
                <span className="small" style={{ color: "var(--zinc-700)" }}>{r.label}</span>
                <div className="bar-track" aria-hidden="true"><div style={{ width: r.pct }} /></div>
                <span style={{ fontWeight: 600, textAlign: "right" }}>{r.value}</span>
              </div>
            ))}
          </div>
        ))}
      </section>
    </>
  );
}
