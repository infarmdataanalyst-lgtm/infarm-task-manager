// /tim/analitik — performa tim dan per orang, dibandingkan dengan periode sebelumnya.
// Task bersama dihitung untuk PIC dan setiap pengerja checklist. Waktu memakai jam kerja (lib/worktime.js).

import React, { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { CATEGORIES, DIVISIONS } from "../../config";
import { finishedOnTime } from "../../lib/dates";
import { bucketLabels, bucketOf, comparePeriods, PERIODS, rangeLabel, within } from "../../lib/periods";
import { fmtDuration, stageMinutes } from "../../lib/worktime";
import { Avatar } from "../../components/ui";

const involved = (t, name) => t.pic === name || t.checklist.some((c) => c.assignee === name);
const avg = (list, fn) => (list.length ? Math.round(list.reduce((s, x) => s + fn(x), 0) / list.length) : null);
const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : null);

// Ukuran satu periode untuk sekumpulan task (seluruh tim, atau task yang melibatkan satu orang).
function measure(tasks, range, takenBy) {
  const finished = tasks.filter((t) => t.status === "finish" && within(t.finishedAt, range));
  const taken = tasks.filter((t) => within(t.startedAt, range) && (!takenBy || t.pic === takenBy));
  return {
    received: tasks.filter((t) => within(t.createdAt, range)).length,
    finished,
    done: finished.length,
    onTime: pct(finished.filter(finishedOnTime).length, finished.length),
    work: avg(finished, (t) => stageMinutes(t).on_progress),
    wait: avg(taken, (t) => stageMinutes(t).request),
    delays: tasks.reduce((n, t) => n + t.workSessions.filter((w) => w.status === "delay" && within(w.startedAt, range)).length, 0),
  };
}

// Teks dan warna selisih. better: "up" bila naik = membaik, "down" bila turun = membaik.
function delta(cur, prev, { better, kind, prevLabel }) {
  if (cur === null || prev === null) return { text: prev === null ? `belum ada data ${prevLabel}` : "-", tone: "flat" };
  const diff = cur - prev;
  if (diff === 0) return { text: `sama dengan ${prevLabel}`, tone: "flat" };
  const good = better === "up" ? diff > 0 : diff < 0;
  if (better === "flat") return { text: `${diff > 0 ? "+" : "−"}${Math.abs(diff)} dari ${prevLabel}`, tone: "flat" };
  let text;
  if (kind === "pct") text = `${diff > 0 ? "+" : "−"}${Math.abs(diff)} poin dari ${prevLabel}`;
  else if (kind === "minutes") text = `${fmtDuration(Math.abs(diff))} ${diff < 0 ? "lebih cepat" : "lebih lama"} dari ${prevLabel}`;
  else text = `${diff > 0 ? "+" : "−"}${Math.abs(diff)} dari ${prevLabel}`;
  return { text, tone: good ? "good" : "bad" };
}

function Metric({ label, value, d }) {
  return (
    <div className="metric">
      <dt>{label}</dt>
      <dd className="value">{value}</dd>
      <dd className={`delta ${d.tone}`}>{d.text}</dd>
    </div>
  );
}

function Bars({ cur, prev, labels, color, unitLabel }) {
  const max = Math.max(1, ...cur, ...prev);
  return (
    <div className="mini-chart" role="img" aria-label={`Task selesai per ${unitLabel}: ${labels.map((l, i) => `${l} ${cur[i]} (sebelumnya ${prev[i]})`).join(", ")}`}>
      {labels.map((l, i) => (
        <div key={l} className="bar-col">
          <div className="bars">
            <span className="prev" style={{ height: `${(prev[i] / max) * 100}%` }} title={`Sebelumnya: ${prev[i]}`} />
            <span className="cur" style={{ height: `${(cur[i] / max) * 100}%`, background: color }} title={`Periode ini: ${cur[i]}`} />
          </div>
          <span className="bar-label">{l}</span>
        </div>
      ))}
    </div>
  );
}

const rows = (tasks, key, values) => {
  const counts = values.map((v) => [v, tasks.filter((t) => t[key] === v).length]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...counts.map((c) => c[1]));
  return counts.map(([label, value]) => ({ label, value, pct: `${Math.round((value / max) * 100)}%` }));
};

export default function AnalyticsPage() {
  const { tasks, designers } = useOutletContext();
  const [period, setPeriod] = useState("this_week");
  const cmp = useMemo(() => comparePeriods(period), [period]);
  const labels = bucketLabels(cmp.unit);
  const opts = { prevLabel: cmp.prevLabel };

  const team = useMemo(() => ({ cur: measure(tasks, cmp.current), prev: measure(tasks, cmp.previous) }), [tasks, cmp]);

  const people = useMemo(
    () =>
      designers.map((d) => {
        const mine = tasks.filter((t) => involved(t, d.name));
        const cur = measure(mine, cmp.current, d.name);
        const prev = measure(mine, cmp.previous, d.name);
        const series = (m, range) => {
          const out = labels.map(() => 0);
          m.finished.forEach((t) => {
            const b = bucketOf(t.finishedAt, range, cmp.unit);
            if (b >= 0 && b < out.length) out[b] += 1;
          });
          return out;
        };
        return {
          ...d,
          cur,
          prev,
          shared: cur.finished.filter((t) => t.pic !== d.name || t.checklist.some((c) => c.assignee && c.assignee !== d.name)).length,
          active: mine.filter((t) => t.status === "on_progress" || t.status === "delay").length,
          curSeries: series(cur, cmp.current),
          prevSeries: series(prev, cmp.previous),
        };
      }),
    [tasks, designers, cmp, labels]
  );

  const received = tasks.filter((t) => within(t.createdAt, cmp.current));

  return (
    <>
      <div className="filter-bar">
        <div className="segmented" role="group" aria-label="Periode">
          {PERIODS.map((p) => (
            <button key={p.key} type="button" aria-pressed={period === p.key} onClick={() => setPeriod(p.key)}>{p.label}</button>
          ))}
        </div>
        <span className="small muted">{rangeLabel(cmp.current)} dibanding {rangeLabel(cmp.previous)} ({cmp.prevLabel})</span>
      </div>

      <section aria-label="Ringkasan tim" className="stats">
        {[
          ["Request masuk", team.cur.received, delta(team.cur.received, team.prev.received, { ...opts, better: "flat" })],
          ["Task selesai", team.cur.done, delta(team.cur.done, team.prev.done, { ...opts, better: "up" })],
          ["Tepat waktu", team.cur.onTime === null ? "-" : `${team.cur.onTime}%`, delta(team.cur.onTime, team.prev.onTime, { ...opts, better: "up", kind: "pct" })],
          ["Rata-rata pengerjaan", team.cur.work === null ? "-" : fmtDuration(team.cur.work), delta(team.cur.work, team.prev.work, { ...opts, better: "down", kind: "minutes" })],
          ["Rata-rata menunggu diambil", team.cur.wait === null ? "-" : fmtDuration(team.cur.wait), delta(team.cur.wait, team.prev.wait, { ...opts, better: "down", kind: "minutes" })],
        ].map(([label, value, d]) => (
          <div key={label} className="card stat">
            <p className="small muted">{label}</p>
            <p className="stat-value">{value}</p>
            <p className={`small delta ${d.tone}`}>{d.text}</p>
          </div>
        ))}
      </section>

      <section aria-label="Per orang" className="grid-auto-340">
        {people.map((p) => (
          <article key={p.email} className="card card-pad stack-lg">
            <div className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
              <Avatar name={p.name} color={p.color} size={40} />
              <div>
                <h2 className="h-section" style={{ fontSize: 16 }}>{p.name}</h2>
                <p className="small muted">{p.active} task aktif · {p.shared} selesai dikerjakan bersama</p>
              </div>
            </div>
            <dl className="metrics">
              <Metric label="Task selesai" value={p.cur.done} d={delta(p.cur.done, p.prev.done, { ...opts, better: "up" })} />
              <Metric label="Tepat waktu" value={p.cur.onTime === null ? "-" : `${p.cur.onTime}%`} d={delta(p.cur.onTime, p.prev.onTime, { ...opts, better: "up", kind: "pct" })} />
              <Metric label="Rata-rata pengerjaan" value={p.cur.work === null ? "-" : fmtDuration(p.cur.work)} d={delta(p.cur.work, p.prev.work, { ...opts, better: "down", kind: "minutes" })} />
              <Metric label="Rata-rata menunggu diambil" value={p.cur.wait === null ? "-" : fmtDuration(p.cur.wait)} d={delta(p.cur.wait, p.prev.wait, { ...opts, better: "down", kind: "minutes" })} />
              <Metric label="Masuk Delay" value={p.cur.delays} d={delta(p.cur.delays, p.prev.delays, { ...opts, better: "down" })} />
            </dl>
            <div className="stack">
              <p className="eyebrow">Task selesai per {cmp.unit === "week" ? "hari" : "minggu"}</p>
              <Bars cur={p.curSeries} prev={p.prevSeries} labels={labels} color={p.color} unitLabel={cmp.unit === "week" ? "hari" : "minggu"} />
              <p className="legend small muted">
                <span><i style={{ background: p.color }} /> Periode ini</span>
                <span><i className="prev" /> {cmp.prevLabel[0].toUpperCase() + cmp.prevLabel.slice(1)}</span>
              </p>
            </div>
          </article>
        ))}
        {!people.length && <p className="empty-box">Belum ada anggota berperan desainer.</p>}
      </section>

      <section className="grid-auto-340">
        {[["Request per kategori", rows(received, "category", CATEGORIES)], ["Request per divisi", rows(received, "division", DIVISIONS)]].map(([title, list]) => (
          <div key={title} className="card card-pad stack">
            <h2 className="h-section">{title}</h2>
            {list.length === 0 && <p className="muted">Belum ada request di periode ini.</p>}
            {list.map((r) => (
              <div key={r.label} className="bar-row">
                <span className="small" style={{ color: "var(--zinc-700)" }}>{r.label}</span>
                <div className="bar-track" aria-hidden="true"><div style={{ width: r.pct }} /></div>
                <span style={{ fontWeight: 600, textAlign: "right" }}>{r.value}</span>
              </div>
            ))}
          </div>
        ))}
      </section>
      <p className="hint">
        Task yang dikerjakan bersama dihitung untuk PIC dan setiap pengerja checklist. Waktu hanya jam kerja Senin–Jumat 08.00–17.00.
        "Menunggu diambil" = waktu di kolom Request untuk task yang diambil orang itu. Periode yang sedang berjalan dibandingkan dengan rentang yang sama panjang di periode sebelumnya.
      </p>
    </>
  );
}
