// /tim/analitik — performa tim dan per desainer, dibandingkan dengan periode sebelumnya.
// Urutan: periode → ringkasan tim → "Kinerja tiap desainer" (kartu per orang) → "Perbandingan antar desainer"
// (grafik garis task selesai per hari, ketepatan waktu, rata-rata waktu per task bertumpuk).
// Semua grafik punya tooltip: hover/fokus keyboard di desktop, ketuk di HP.
// Task bersama dihitung untuk PIC dan setiap pengerja checklist. Waktu memakai jam kerja (lib/worktime.js).

import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { CalendarDays, Info, Printer, X } from "lucide-react";
import { CATEGORIES, DIVISIONS } from "../../config";
import { finishedOnTime } from "../../lib/dates";
import { bucketLabels, bucketOf, bucketShort, bucketTitle, comparePeriods, customPeriods, dayAt, dayCount, dayIndex, longDate, PERIODS, rangeError, rangeLabel, rangePresets, toYmd, within } from "../../lib/periods";
import { STORAGE_MODE } from "../../config";
import * as actions from "../../data/taskActions";
import { daysBetween, fmtDayShort, fmtLongDate, parseDay } from "../../lib/dates";
import { helpers } from "../../data/taskModel";
import { fmtDuration, stageMinutes, WORKDAY_MINUTES } from "../../lib/worktime";
import { Avatar, Modal } from "../../components/ui";

const involved = (t, name) => t.pic === name || t.checklist.some((c) => c.assignee === name);
const avg = (list, fn) => (list.length ? Math.round(list.reduce((s, x) => s + fn(x), 0) / list.length) : null);
const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : null);
const MAX_TITLES = 5;
const DASHES = ["", "6 4", "2 3", "10 3 2 3"]; // garis desainer ke-2, ke-3, … tetap terbedakan tanpa warna

// Ukuran satu periode untuk sekumpulan task (seluruh tim, atau task yang melibatkan satu orang).
// Semua rata-rata waktu dihitung dari task yang SAMA (selesai di periode ini), jadi bisa dijumlah.
function measure(tasks, range) {
  const finished = tasks.filter((t) => t.status === "finish" && within(t.finishedAt, range));
  const stages = finished.map((t) => stageMinutes(t));
  const work = stages.map((s) => s.on_progress);
  return {
    received: tasks.filter((t) => within(t.createdAt, range)).length,
    finished,
    done: finished.length,
    onTimeCount: finished.filter(finishedOnTime).length,
    onTime: pct(finished.filter(finishedOnTime).length, finished.length),
    work: avg(stages, (s) => s.on_progress),
    wait: avg(stages, (s) => s.request),
    delay: avg(stages, (s) => s.delay),
    workMin: work.length ? Math.min(...work) : null,
    workMax: work.length ? Math.max(...work) : null,
    delays: tasks.reduce((n, t) => n + t.workSessions.filter((w) => w.status === "delay" && within(w.startedAt, range)).length, 0),
  };
}

// Teks dan warna selisih. better: "up" bila naik = membaik, "down" bila turun = membaik, "flat" = netral.
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
const diffText = (cur, prev, prevLabel) => (cur === prev ? `sama dengan ${prevLabel}` : `${cur > prev ? "+" : "−"}${Math.abs(cur - prev)} dari ${prevLabel}`);

// Sumbu angka yang rapi: 0..top dengan maksimal ±5 garis.
function niceTicks(max) {
  const step = Math.max(1, Math.ceil(Math.max(1, max) / 4));
  const top = step * Math.ceil(Math.max(1, max) / step);
  const ticks = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  return { top, ticks };
}

// Posisi tooltip: rata kiri/kanan di ujung grafik supaya tidak keluar layar.
const tipAlign = (i, n) => (i < n * 0.25 ? "left" : i >= n * 0.75 ? "right" : "center");

// Satu tooltip aktif per grafik. Hover/fokus menampilkan; ketuk juga (HP), ketuk tempat lain = blur → tutup.
function useTip() {
  const [tip, setTip] = useState(null);
  const bind = (key) => ({
    onMouseEnter: () => setTip(key),
    onMouseLeave: () => setTip(null),
    onFocus: () => setTip(key),
    onBlur: () => setTip(null),
    onClick: () => setTip(key),
  });
  return [tip, bind];
}

function InfoTip({ label, children }) {
  const [tip, bind] = useTip();
  return (
    <span className="info-tip">
      <button type="button" className="info-btn" aria-label={`Penjelasan: ${label}`} aria-expanded={tip === 1} {...bind(1)}>
        <Info size={13} aria-hidden="true" />
      </button>
      {tip === 1 && <span role="tooltip" className="chart-tip info">{children}</span>}
    </span>
  );
}

function Metric({ label, value, d, info }) {
  return (
    <div className="metric">
      <dt>
        {label}
        {info && <InfoTip label={label}>{info}</InfoTip>}
      </dt>
      <dd className="value">{value}</dd>
      <dd className={`delta ${d.tone}`}>{d.text}</dd>
    </div>
  );
}

// Grafik batang per orang: periode ini vs pembanding, sumbu angka, angka di atas batang, tooltip per kelompok.
function DayBars({ cur, prev, labels, titles, prevTitles, tasksByBucket, color, cmp }) {
  const [tip, bind] = useTip();
  const dense = labels.length > 14; // banyak batang: angka cukup di tooltip, label tanggal tiap 5
  const { top, ticks } = niceTicks(Math.max(...cur, ...prev));
  const h = (v) => `${(v / top) * 100}%`;
  const barH = (v) => `calc((100% - 14px) * ${v / top})`; // kolom batang 14px lebih tinggi untuk angka di atasnya
  return (
    <div className="chart">
      <div className="chart-plot with-axis">
        <div className="y-axis" aria-hidden="true">
          {ticks.map((v) => <span key={v} style={{ bottom: h(v) }}>{v}</span>)}
        </div>
        <div className="plot">
          <div className="plot-area">
          {ticks.map((v) => <span key={v} className={`grid-line ${v ? "" : "base"}`} style={{ bottom: h(v) }} aria-hidden="true" />)}
          <div className={`bar-groups ${dense ? "dense" : ""}`}>
            {labels.map((l, i) => (
              <button key={l} type="button" className={`bar-group ${tip === i ? "active" : ""}`} {...bind(i)}
                aria-label={`${titles[i]}: ${cur[i]} task selesai, ${cmp.prevLabel} ${prev[i]}`}>
                <span className="bar-slot">
                  <span className={`bar-num muted ${dense ? "screen-hide" : ""}`}>{prev[i] || ""}</span>
                  <span className="bar prev" style={{ height: barH(prev[i]) }} />
                </span>
                <span className="bar-slot">
                  <span className={`bar-num ${dense ? "screen-hide" : ""}`} style={{ color }}>{cur[i] || ""}</span>
                  <span className="bar" style={{ height: barH(cur[i]), background: color }} />
                </span>
                {tip === i && (
                  <span role="tooltip" className={`chart-tip ${tipAlign(i, labels.length)}`}>
                    <strong>{titles[i]}</strong>
                    <span className="tip-grid">
                      <i style={{ background: color }} />
                      <span>Periode ini</span>
                      <b>{cur[i]} task</b>
                      <i className="prev" />
                      <span>{prevTitles[i]}</span>
                      <b>{prev[i]} task</b>
                    </span>
                    <span className="tip-diff">{diffText(cur[i], prev[i], cmp.prevLabel)}</span>
                    {tasksByBucket[i].length > 0 && (
                      <span className="tip-list">
                        {tasksByBucket[i].slice(0, MAX_TITLES).map((t) => <span key={t.id}>· {t.title}</span>)}
                        {tasksByBucket[i].length > MAX_TITLES && <span>+{tasksByBucket[i].length - MAX_TITLES} lainnya</span>}
                      </span>
                    )}
                  </span>
                )}
              </button>
            ))}
          </div>
          </div>
          <div className="x-labels" aria-hidden="true">
            {labels.map((l, i) => <span key={l}>{!dense || i % 5 === 0 ? l : ""}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}

function Legend({ people, vertical }) {
  return (
    <ul className={`chart-legend ${vertical ? "vertical" : ""}`}>
      {people.map((p, i) => (
        <li key={p.email}>
          <svg width="18" height="10" aria-hidden="true"><line x1="1" y1="5" x2="17" y2="5" stroke={p.color} strokeWidth="3" strokeDasharray={DASHES[i % DASHES.length]} /></svg>
          <strong>{p.name}</strong>
        </li>
      ))}
    </ul>
  );
}

// Grafik garis: task selesai per hari (Minggu ini 7 titik, Bulan ini 28–31 titik), satu garis per desainer.
function DailyLines({ people, cmp }) {
  const [tip, bind] = useTip();
  const days = dayCount(cmp.current);
  const lastDay = Math.min(days - 1, dayIndex(new Date().toISOString(), cmp.current)); // hari yang belum lewat tidak digambar
  const series = people.map((p) => {
    const out = Array.from({ length: days }, () => 0);
    p.cur.finished.forEach((t) => {
      const i = dayIndex(t.finishedAt, cmp.current);
      if (i >= 0 && i < days) out[i] += 1;
    });
    return out;
  });
  const { top, ticks } = niceTicks(Math.max(0, ...series.flat()));
  const x = (i) => (days === 1 ? 50 : (i / (days - 1)) * 100);
  const y = (v) => (v / top) * 100;
  const showDots = days <= 7;
  const labelEvery = days <= 7 ? 1 : days <= 31 ? 5 : Math.ceil(days / 8);
  const dayLabel = (i) => {
    const d = dayAt(cmp.current, i);
    if (days <= 7) return `${["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"][d.getDay()]} ${d.getDate()}`;
    return days <= 31 ? String(d.getDate()) : d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  };
  return (
    <div className="chart-with-legend">
      <div className="chart-plot with-axis tall">
        <div className="y-axis" aria-hidden="true">
          {ticks.map((v) => <span key={v} style={{ bottom: `${y(v)}%` }}>{v}</span>)}
        </div>
        <div className="plot">
          <div className="plot-area">
          {ticks.map((v) => <span key={v} className={`grid-line ${v ? "" : "base"}`} style={{ bottom: `${y(v)}%` }} aria-hidden="true" />)}
          <div className="line-area">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {series.map((s, si) => (
                <polyline key={people[si].email} fill="none" stroke={people[si].color} strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
                  strokeDasharray={DASHES[si % DASHES.length]} points={s.slice(0, lastDay + 1).map((v, i) => `${x(i)},${100 - y(v)}`).join(" ")} />
              ))}
            </svg>
            {tip !== null && <span className="hover-line" style={{ left: `${x(tip)}%` }} aria-hidden="true" />}
            {series.map((s, si) =>
              s.slice(0, lastDay + 1).map((v, i) => (
                <React.Fragment key={`${si}-${i}`}>
                  <span className={`dot-point ${tip === i ? "active" : ""} ${showDots || tip === i ? "" : "screen-hide"}`} aria-hidden="true"
                    style={{ left: `${x(i)}%`, bottom: `${y(v)}%`, borderColor: people[si].color }} />
                  {v > 0 && (
                    <span className={`point-val print-only ${si % 2 ? "below" : ""}`} aria-hidden="true" style={{ left: `${x(i)}%`, bottom: `${y(v)}%`, color: people[si].color }}>{v}</span>
                  )}
                </React.Fragment>
              ))
            )}
            <div className="hover-zones">
              {Array.from({ length: days }, (_, i) => (
                <button key={i} type="button" className="hover-zone" {...bind(i)}
                  aria-label={`${longDate(dayAt(cmp.current, i))}: ${people.map((p, si) => `${p.name} ${i <= lastDay ? series[si][i] : "-"} task`).join(", ")}`}>
                  {tip === i && (
                    <span role="tooltip" className={`chart-tip ${tipAlign(i, days)}`}>
                      <strong>{longDate(dayAt(cmp.current, i))}</strong>
                      <span className="tip-grid">
                        {people.map((p, si) => (
                          <React.Fragment key={p.email}>
                            <i style={{ background: p.color }} />
                            <span>{p.name}</span>
                            <b>{i <= lastDay ? `${series[si][i]} task` : "belum lewat"}</b>
                          </React.Fragment>
                        ))}
                      </span>
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          </div>
          <div className="x-labels positioned" aria-hidden="true">
            {Array.from({ length: days }, (_, i) => (i % labelEvery === 0 || (labelEvery > 1 && i === days - 1 && (days - 1) % labelEvery > 2)) && (
              <span key={i} style={{ left: `${x(i)}%` }}>{dayLabel(i)}</span>
            ))}
          </div>
        </div>
      </div>
      <Legend people={people} vertical />
    </div>
  );
}

// Batang horizontal ketepatan waktu, sumbu x 0–100%.
function OnTimeBars({ people }) {
  const [tip, bind] = useTip();
  return (
    <div className="hbars">
      {people.map((p, i) => {
        const late = p.cur.finished.filter((t) => !finishedOnTime(t));
        return (
          <div key={p.email} className="hbar-row">
            <button type="button" className="hbar-track" {...bind(i)}
              aria-label={`${p.name}: ${p.cur.onTime === null ? "belum ada task selesai" : `${p.cur.onTimeCount} dari ${p.cur.done} task tepat waktu (${p.cur.onTime}%)`}`}>
              {p.cur.onTime !== null && (
                <span className="hbar-fill" style={{ width: `${Math.max(p.cur.onTime, 2)}%`, background: p.color }}>
                  {p.cur.onTime >= 15 && `${p.cur.onTime}%`}
                </span>
              )}
              {p.cur.onTime !== null && p.cur.onTime < 15 && <span className="hbar-out">{p.cur.onTime}%</span>}
              {tip === i && (
                <span role="tooltip" className="chart-tip left">
                  <strong>{p.name}</strong>
                  {p.cur.done ? (
                    <>
                      <span>{p.cur.onTimeCount} dari {p.cur.done} task selesai tepat waktu ({p.cur.onTime}%)</span>
                      {late.length > 0 && (
                        <span className="tip-list late">
                          {late.slice(0, MAX_TITLES).map((t) => <span key={t.id}>Terlambat: {t.title}</span>)}
                          {late.length > MAX_TITLES && <span>+{late.length - MAX_TITLES} lainnya</span>}
                        </span>
                      )}
                    </>
                  ) : (
                    <span>Belum ada task selesai di periode ini.</span>
                  )}
                </span>
              )}
            </button>
            <span className="hbar-name">
              <i style={{ background: p.color }} />
              <strong>{p.name}</strong>
              <span className="muted">{p.cur.done ? `${p.cur.onTimeCount} dari ${p.cur.done} task` : "belum ada"}</span>
            </span>
          </div>
        );
      })}
      <div className="hbar-row">
        <div className="x-axis" aria-hidden="true">
          {[0, 25, 50, 75, 100].map((v) => <span key={v} style={{ left: `${v}%` }}>{v}%</span>)}
        </div>
        <span />
      </div>
    </div>
  );
}

const SEGMENTS = [
  { key: "wait", label: "Menunggu dikerjakan", where: "di Request", cls: "seg-wait" },
  { key: "work", label: "Pengerjaan", where: "di On Progress", cls: "seg-work" },
  { key: "delay", label: "Ditunda", where: "di Delay", cls: "seg-delay" },
];
const shortHours = (min) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}j${m ? ` ${m}m` : ""}` : `${m}m`;
};

// Batang horizontal bertumpuk: rata-rata waktu per task = menunggu + pengerjaan + ditunda (jam kerja).
function TimeStacks({ people }) {
  const [tip, bind] = useTip();
  const rows = people.map((p) => ({ p, v: { wait: p.cur.wait || 0, work: p.cur.work || 0, delay: p.cur.delay || 0 } }));
  const maxTotal = Math.max(60, ...rows.map((r) => r.v.wait + r.v.work + r.v.delay));
  const stepH = Math.max(1, Math.ceil(maxTotal / 60 / 4));
  const topH = stepH * Math.ceil(maxTotal / 60 / stepH);
  const w = (min) => `${(min / (topH * 60)) * 100}%`;
  return (
    <div className="hbars">
      <ul className="chart-legend">
        {SEGMENTS.map((s) => <li key={s.key}><i className={s.cls} />{s.label} ({s.where})</li>)}
      </ul>
      {rows.map(({ p, v }) => {
        const total = v.wait + v.work + v.delay;
        return (
          <div key={p.email} className="hbar-row">
            <div className="hbar-track stacked">
              {p.cur.done === 0 && <span className="muted small" style={{ padding: "0 10px" }}>Belum ada task selesai</span>}
              {p.cur.done > 0 && SEGMENTS.map((s) => v[s.key] > 0 && (
                <button key={s.key} type="button" className={`seg ${s.cls} ${tip === `${p.email}-${s.key}` ? "active" : ""}`} style={{ width: w(v[s.key]) }}
                  {...bind(`${p.email}-${s.key}`)} aria-label={`${p.name}, ${s.label}: rata-rata ${fmtDuration(v[s.key])}`}>
                  {v[s.key] / (topH * 60) >= 0.1 && shortHours(v[s.key])}
                  {tip === `${p.email}-${s.key}` && (
                    <span role="tooltip" className="chart-tip left">
                      <strong>{p.name} · {s.label}</strong>
                      <span>Rata-rata {fmtDuration(v[s.key])} per task ({s.where}), dari {p.cur.done} task selesai</span>
                      {s.key === "work" && p.cur.workMin !== null && <span className="muted-light">Tercepat {fmtDuration(p.cur.workMin)} · terlama {fmtDuration(p.cur.workMax)}</span>}
                      <span className="tip-total">Total rata-rata per task: {fmtDuration(total)}</span>
                    </span>
                  )}
                </button>
              ))}
            </div>
            <span className="hbar-name">
              <i style={{ background: p.color }} />
              <strong>{p.name}</strong>
              <span className="muted">{p.cur.done ? `total ${fmtDuration(total)}` : "-"}</span>
            </span>
          </div>
        );
      })}
      <div className="hbar-row">
        <div className="x-axis" aria-hidden="true">
          {Array.from({ length: Math.round(topH / stepH) + 1 }, (_, k) => k * stepH).map((h) => (
            <span key={h} style={{ left: `${(h / topH) * 100}%` }}>{h} jam</span>
          ))}
        </div>
        <span />
      </div>
    </div>
  );
}

const rows = (tasks, key, values) => {
  const counts = values.map((v) => [v, tasks.filter((t) => t[key] === v).length]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...counts.map((c) => c[1]));
  const total = counts.reduce((s, c) => s + c[1], 0);
  return counts.map(([label, value]) => ({ label, value, pct: `${Math.round((value / max) * 100)}%`, share: Math.round((value / total) * 100) }));
};

function BreakdownBars({ list }) {
  const [tip, bind] = useTip();
  return list.map((r) => (
    <button key={r.label} type="button" className="bar-row bar-row-btn" {...bind(r.label)} aria-label={`${r.label}: ${r.value} request (${r.share}%)`}>
      <span className="small" style={{ color: "var(--zinc-700)", textAlign: "left" }}>{r.label}</span>
      <span className="bar-track" aria-hidden="true"><span style={{ width: r.pct }} /></span>
      <span style={{ fontWeight: 600, textAlign: "right" }}>{r.value}</span>
      {tip === r.label && <span role="tooltip" className="chart-tip left">{r.label}: {r.value} request ({r.share}% dari periode ini)</span>}
    </button>
  ));
}

// Tabel "Daftar task selesai" di rentang terpilih: hanya muncul di hasil cetak / PDF (paling bawah).
function FinishedTable({ tasks, range }) {
  const list = tasks.filter((t) => t.status === "finish" && within(t.finishedAt, range)).sort((a, b) => new Date(a.finishedAt) - new Date(b.finishedAt));
  const onTime = list.filter(finishedOnTime).length;
  const byPic = list.reduce((m, t) => ({ ...m, [t.pic || "-"]: (m[t.pic || "-"] || 0) + 1 }), {});
  const work = list.map((t) => stageMinutes(t).on_progress);
  const avgWork = work.length ? Math.round(work.reduce((a, b) => a + b, 0) / work.length) : null;
  const day = (iso) => new Date(iso).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
  const late = (t) => (t.dueDate ? daysBetween(parseDay(t.dueDate), new Date(t.finishedAt)) : 0);
  return (
    <section className="print-only print-table" aria-label="Daftar task selesai">
      <div className="row-between">
        <h2 className="h-section">Daftar task selesai · {rangeLabel(range)}</h2>
        <span className="small muted">
          <strong>{list.length} task</strong>{list.length > 0 && ` · ${onTime} tepat waktu (${Math.round((onTime / list.length) * 100)}%) · ${Object.entries(byPic).map(([n, c]) => `${n} ${c}`).join(" · ")}`}
        </span>
      </div>
      {list.length === 0 ? (
        <p className="muted">Tidak ada task yang selesai di rentang ini.</p>
      ) : (
        <table className="report-table">
          <thead>
            <tr>
              <th>No</th><th>Selesai</th><th>Judul</th><th>Kategori</th><th>Requester (divisi)</th><th>PIC</th><th>Bersama</th>
              <th>Deadline</th><th>Ketepatan</th><th>Pengerjaan</th><th>Total waktu</th><th>Link hasil</th>
            </tr>
          </thead>
          <tbody>
            {list.map((t, i) => {
              const st = stageMinutes(t);
              const ok = finishedOnTime(t);
              return (
                <tr key={t.id}>
                  <td>{i + 1}</td>
                  <td className="nowrap">{day(t.finishedAt)}</td>
                  <td className="strong">{t.title}</td>
                  <td>{t.category}</td>
                  <td>{t.requesterName} ({t.division})</td>
                  <td className="nowrap">{t.pic || "-"}</td>
                  <td>{helpers(t).join(", ") || "-"}</td>
                  <td className="nowrap">{t.dueDate ? fmtDayShort(t.dueDate) : "-"}</td>
                  <td><span className={`report-tag ${ok ? "ok" : "late"}`}>{ok ? "Tepat waktu" : `Terlambat ${late(t)} hari`}</span></td>
                  <td className="nowrap">{fmtDuration(st.on_progress)}</td>
                  <td className="nowrap">{fmtDuration(st.total)}</td>
                  <td>{t.resultLinks.length ? "Ada" : "-"}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={8}>Total {list.length} task{avgWork !== null && ` · rata-rata pengerjaan ${fmtDuration(avgWork)}`}</td>
              <td>{Math.round((onTime / list.length) * 100)}%</td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      )}
    </section>
  );
}

// Panel "Pilih tanggal": pilihan cepat + dari/sampai. Desktop: melayang di bawah tombol; HP: lembar dari bawah.
function RangePanel({ initial, onApply, onClose }) {
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const presets = useMemo(() => rangePresets(), []);
  const error = rangeError(from, to);
  const preview = !error ? customPeriods(from, to) : null;
  return (
    <Modal labelledBy="pilih-tanggal" onClose={onClose} className="range-panel">
      <div className="modal-head">
        <h2 id="pilih-tanggal" className="h-section grow">Pilih tanggal laporan</h2>
        <button type="button" className="icon-btn icon-btn-close" aria-label="Tutup" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="stack">
        <p className="eyebrow">Pilihan cepat</p>
        <div className="preset-chips">
          {presets.map((p) => (
            <button key={p.key} type="button" className="preset-chip" aria-pressed={p.from === from && p.to === to} onClick={() => { setFrom(p.from); setTo(p.to); }}>{p.label}</button>
          ))}
        </div>
      </div>
      <div className="grid-2 keep">
        <div className="field">
          <label className="label" htmlFor="r-dari">Dari tanggal</label>
          <input id="r-dari" type="date" className="input" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="r-sampai">Sampai tanggal</label>
          <input id="r-sampai" type="date" className="input" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>
      {error ? (
        <p className="error-text" role="alert">{error}</p>
      ) : (
        <p className="range-summary">
          <strong>{preview.progress.days} hari</strong> ({rangeLabel(preview.current)}), grafik {preview.unit === "days" ? "per hari" : "per minggu"}.
          <br />Dibandingkan dengan {preview.progress.days} hari sebelumnya: {rangeLabel(preview.previous)}.
        </p>
      )}
      <div className="modal-actions">
        <button type="button" className="btn btn-neutral" onClick={onClose}>Batal</button>
        <button type="button" className="btn btn-primary" disabled={!!error} onClick={() => onApply(from, to)}>Terapkan</button>
      </div>
    </Modal>
  );
}

export default function AnalyticsPage() {
  const { tasks: loadedTasks, designers, exportRef } = useOutletContext();
  // Periode: ?periode=bulan, atau rentang pilihan ?dari=YYYY-MM-DD&sampai=YYYY-MM-DD (link laporan bisa dibagikan).
  const [params, setParams] = useSearchParams();
  const dari = params.get("dari");
  const sampai = params.get("sampai");
  const isCustom = !!dari && !!sampai && !rangeError(dari, sampai);
  const period = isCustom ? "custom" : params.get("periode") === "bulan" ? "this_month" : "this_week";
  const [panelOpen, setPanelOpen] = useState(false);
  const cmp = useMemo(() => (isCustom ? customPeriods(dari, sampai) : comparePeriods(period)), [isCustom, dari, sampai, period]);
  const labels = useMemo(() => bucketLabels(cmp.unit, cmp.current), [cmp]);
  const opts = { prevLabel: cmp.prevLabel };
  const unitWord = cmp.unit === "week" || cmp.unit === "days" ? "hari" : "minggu";
  const choose = (key) => setParams(key === "this_month" ? { periode: "bulan" } : {});
  const applyRange = (from, to) => {
    setParams({ dari: from, sampai: to });
    setPanelOpen(false);
  };

  // Rentang lama: board hanya memuat task aktif + 500 Finish terbaru, jadi ambil task di rentang itu langsung dari database.
  const [extra, setExtra] = useState([]);
  useEffect(() => {
    if (!isCustom || STORAGE_MODE !== "supabase") return setExtra([]);
    let alive = true;
    actions.listTasksBetween(cmp.previous.from.toISOString(), cmp.current.to.toISOString())
      .then((list) => alive && setExtra(list))
      .catch(() => alive && setExtra([]));
    return () => {
      alive = false;
    };
  }, [isCustom, cmp]);
  const tasks = useMemo(() => {
    if (!extra.length) return loadedTasks;
    const ids = new Set(loadedTasks.map((t) => t.id));
    return [...loadedTasks, ...extra.filter((t) => !ids.has(t.id) && !t.deletedAt)];
  }, [loadedTasks, extra]);

  // Export CSV di header: task yang masuk atau selesai di periode terpilih.
  useEffect(() => {
    if (!exportRef) return undefined;
    exportRef.current = {
      label: `analitik ${rangeLabel(cmp.current)}`,
      filename: `infarm-analitik-${toYmd(cmp.current.from)}_${toYmd(new Date(cmp.current.to.getTime() - 1))}.csv`,
      tasks: () => tasks.filter((t) => within(t.createdAt, cmp.current) || within(t.finishedAt, cmp.current)).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    };
    return () => {
      exportRef.current = null;
    };
  }, [exportRef, tasks, cmp]);

  // Cetak / simpan PDF: judul dokumen = nama file PDF.
  useEffect(() => {
    const original = document.title;
    const before = () => (document.title = `Laporan analitik tim desain ${rangeLabel(cmp.current)}`);
    const after = () => (document.title = original);
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
      document.title = original;
    };
  }, [cmp]);

  const team = useMemo(() => ({ cur: measure(tasks, cmp.current), prev: measure(tasks, cmp.previous) }), [tasks, cmp]);

  const people = useMemo(
    () =>
      designers.map((d) => {
        const mine = tasks.filter((t) => involved(t, d.name));
        const cur = measure(mine, cmp.current);
        const prev = measure(mine, cmp.previous);
        const groups = (m, range) => {
          const out = labels.map(() => []);
          m.finished.forEach((t) => {
            const b = bucketOf(t.finishedAt, range, cmp.unit);
            if (b >= 0 && b < out.length) out[b].push(t);
          });
          return out;
        };
        const curGroups = groups(cur, cmp.current);
        return {
          ...d,
          cur,
          prev,
          shared: cur.finished.filter((t) => t.pic !== d.name || t.checklist.some((c) => c.assignee && c.assignee !== d.name)).length,
          active: mine.filter((t) => t.status === "on_progress" || t.status === "delay").length,
          curGroups,
          curSeries: curGroups.map((g) => g.length),
          prevSeries: groups(prev, cmp.previous).map((g) => g.length),
        };
      }),
    [tasks, designers, cmp, labels]
  );

  const titles = labels.map((_, i) => bucketTitle(cmp.current, cmp.unit, i));
  const prevTitles = labels.map((_, i) => `${cmp.prevLabel[0].toUpperCase() + cmp.prevLabel.slice(1)} (${bucketShort(cmp.previous, cmp.unit, i)})`);
  const received = tasks.filter((t) => within(t.createdAt, cmp.current));
  const INFO = {
    done: "Task yang masuk Finish di periode ini. Task bersama dihitung untuk PIC dan setiap pengerja checklist.",
    onTime: "Persen task selesai di periode ini yang selesai sebelum atau pada hari deadline.",
    work: "Rata-rata waktu di kolom On Progress (sejak Mulai kerjakan sampai Finish, tanpa waktu Delay), dari task yang selesai di periode ini. Hanya jam kerja Sen–Jum 08.00–17.00.",
    wait: "Rata-rata waktu di kolom Request (sejak request masuk sampai Mulai kerjakan), dari task yang selesai di periode ini. Hanya jam kerja.",
    delays: "Berapa kali task dipindah ke Delay di periode ini.",
  };

  return (
    <>
      <header className="print-only print-head">
        <img src="/logo-infarm.png" alt="Logo Infarm" className="print-logo" />
        <div className="grow">
          <strong>Laporan analitik tim desain</strong>
          <span className="print-range">{rangeLabel(cmp.current)} <span className="muted">· dibanding {rangeLabel(cmp.previous)} ({cmp.prevLabel})</span></span>
        </div>
        <div className="print-meta">
          <strong>INFARM.ID · Tim Desain</strong>
          <span>Dicetak {fmtLongDate(new Date())}</span>
        </div>
      </header>
      <div className="filter-bar no-print">
        <div className="segmented" role="group" aria-label="Periode">
          {PERIODS.map((p) => (
            <button key={p.key} type="button" aria-pressed={period === p.key} onClick={() => choose(p.key)}>{p.label}</button>
          ))}
          <button type="button" aria-pressed={isCustom} aria-haspopup="dialog" onClick={() => setPanelOpen(true)} className="range-btn">
            <CalendarDays size={15} aria-hidden="true" /> {isCustom ? rangeLabel(cmp.current) : "Pilih tanggal"}
          </button>
        </div>
        <span className="small muted grow">
          {rangeLabel(cmp.current)}{cmp.custom ? ` (${cmp.progress.days} hari)` : ""} dibanding {rangeLabel(cmp.previous)} ({cmp.prevLabel})
          {cmp.progress.running && ` · periode masih berjalan, hari ke-${cmp.progress.day} dari ${cmp.progress.days}`}
        </span>
        <button type="button" className="btn btn-outline" onClick={() => window.print()}>
          <Printer size={16} aria-hidden="true" /> Cetak / simpan PDF
        </button>
      </div>
      {panelOpen && (
        <RangePanel
          initial={isCustom ? { from: dari, to: sampai } : rangePresets()[0]}
          onApply={applyRange}
          onClose={() => setPanelOpen(false)}
        />
      )}

      <section aria-label="Ringkasan tim" className="stats">
        {[
          ["Request masuk", team.cur.received, delta(team.cur.received, team.prev.received, { ...opts, better: "flat" })],
          ["Task selesai", team.cur.done, delta(team.cur.done, team.prev.done, { ...opts, better: "up" })],
          ["Tepat waktu", team.cur.onTime === null ? "-" : `${team.cur.onTime}%`, delta(team.cur.onTime, team.prev.onTime, { ...opts, better: "up", kind: "pct" })],
          ["Rata-rata pengerjaan", team.cur.work === null ? "-" : fmtDuration(team.cur.work), delta(team.cur.work, team.prev.work, { ...opts, better: "down", kind: "minutes" })],
          ["Rata-rata menunggu dikerjakan", team.cur.wait === null ? "-" : fmtDuration(team.cur.wait), delta(team.cur.wait, team.prev.wait, { ...opts, better: "down", kind: "minutes" })],
        ].map(([label, value, d]) => (
          <div key={label} className="card stat">
            <p className="small muted">{label}</p>
            <p className="stat-value">{value}</p>
            <p className={`small delta ${d.tone}`}>{d.text}</p>
          </div>
        ))}
      </section>

      <div className="section-head">
        <h2 className="h-section">Kinerja tiap desainer</h2>
        <p className="small muted">Angka masing-masing desainer dibanding {cmp.prevLabel}</p>
      </div>
      <section aria-label="Kinerja tiap desainer" className="grid-auto-340">
        {people.map((p) => (
          <article key={p.email} className="card card-pad stack-lg">
            <div className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
              <Avatar name={p.name} color={p.color} size={40} />
              <div>
                <h3 className="h-section" style={{ fontSize: 16 }}>{p.name}</h3>
                <p className="small muted">{p.active} task aktif · {p.shared} selesai dikerjakan bersama</p>
              </div>
            </div>
            <dl className="metrics">
              <Metric label="Task selesai" value={p.cur.done} d={delta(p.cur.done, p.prev.done, { ...opts, better: "up" })} info={INFO.done} />
              <Metric label="Tepat waktu" value={p.cur.onTime === null ? "-" : `${p.cur.onTime}%`} d={delta(p.cur.onTime, p.prev.onTime, { ...opts, better: "up", kind: "pct" })}
                info={<>{INFO.onTime}{p.cur.done > 0 && <span className="tip-total">{p.cur.onTimeCount} dari {p.cur.done} task tepat waktu</span>}</>} />
              <Metric label="Rata-rata pengerjaan" value={p.cur.work === null ? "-" : fmtDuration(p.cur.work)} d={delta(p.cur.work, p.prev.work, { ...opts, better: "down", kind: "minutes" })}
                info={<>{INFO.work}{p.cur.workMin !== null && <span className="tip-total">Dari {p.cur.done} task · tercepat {fmtDuration(p.cur.workMin)} · terlama {fmtDuration(p.cur.workMax)}</span>}</>} />
              <Metric label="Rata-rata menunggu dikerjakan" value={p.cur.wait === null ? "-" : fmtDuration(p.cur.wait)} d={delta(p.cur.wait, p.prev.wait, { ...opts, better: "down", kind: "minutes" })} info={INFO.wait} />
              <Metric label="Masuk Delay" value={p.cur.delays} d={delta(p.cur.delays, p.prev.delays, { ...opts, better: "down" })} info={INFO.delays} />
            </dl>
            <div className="stack">
              <p className="eyebrow">Task selesai per {unitWord}</p>
              <DayBars cur={p.curSeries} prev={p.prevSeries} labels={labels} titles={titles} prevTitles={prevTitles} tasksByBucket={p.curGroups} color={p.color} cmp={cmp} />
              <p className="legend small muted">
                <span><i style={{ background: p.color }} /> Periode ini</span>
                <span><i className="prev" /> {cmp.prevLabel[0].toUpperCase() + cmp.prevLabel.slice(1)}</span>
                <span className="hide-mobile no-print">Arahkan kursor ke batang untuk melihat angkanya</span>
                <span className="show-mobile no-print">Ketuk batang untuk melihat angkanya</span>
              </p>
            </div>
          </article>
        ))}
        {!people.length && <p className="empty-box">Belum ada anggota berperan desainer.</p>}
      </section>

      {people.length > 0 && (
        <>
          <div className="compare-block">
          <div className="section-head">
            <h2 className="h-section">Perbandingan antar desainer</h2>
            <p className="small muted">{people.map((p) => p.name).join(" dan ")} dalam satu grafik, periode yang sama</p>
          </div>
          <section aria-label="Perbandingan antar desainer" className="compare-grid">
            <div className="card card-pad stack">
              <div className="row-between">
                <h3 className="h-sub">Task selesai per hari</h3>
                <span className="small muted">Total: {people.map((p, i) => <React.Fragment key={p.email}>{i > 0 && " · "}{p.name} <strong style={{ color: p.color }}>{p.cur.done}</strong></React.Fragment>)}</span>
              </div>
              <DailyLines people={people} cmp={cmp} />
            </div>
            <div className="card card-pad stack">
              <div className="row-between">
                <h3 className="h-sub">Ketepatan waktu</h3>
                <span className="small muted">Selesai sebelum/pada deadline</span>
              </div>
              <OnTimeBars people={people} />
            </div>
            <div className="card card-pad stack compare-wide">
              <div className="row-between">
                <h3 className="h-sub">Rata-rata waktu per task: menunggu, dikerjakan, ditunda</h3>
                <span className="small muted">Jam kerja, dari task yang selesai di periode ini ({people.map((p) => `${p.name} ${p.cur.done} task`).join(", ")})</span>
              </div>
              <TimeStacks people={people} />
            </div>
          </section>
          </div>
        </>
      )}

      <section className="grid-auto-340">
        {[["Request per kategori", rows(received, "category", CATEGORIES)], ["Request per divisi", rows(received, "division", DIVISIONS)]].map(([title, list]) => (
          <div key={title} className="card card-pad stack">
            <h2 className="h-section">{title}</h2>
            {list.length === 0 && <p className="muted">Belum ada request di periode ini.</p>}
            <BreakdownBars list={list} />
          </div>
        ))}
      </section>
      <FinishedTable tasks={tasks} range={cmp.current} />
      <p className="hint">
        Task yang dikerjakan bersama dihitung untuk PIC dan setiap pengerja checklist. Waktu hanya jam kerja Senin–Jumat 08.00–17.00 (1 hari = {WORKDAY_MINUTES / 60} jam kerja).
        Semua rata-rata waktu dihitung dari task yang selesai di periode ini. Periode ini dibandingkan dengan periode penuh sebelumnya; selama periode ini belum selesai, angkanya masih bisa bertambah.
      </p>
    </>
  );
}
