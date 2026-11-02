// Waktu kerja: hanya jam kerja Senin–Jumat 08.00–17.00 WIB (UTC+7, tanpa DST).
// Padanan SQL: work_minutes() di supabase/schema.sql. Keduanya harus menghitung sama.

const WIB_OFFSET = 7 * 3600000;
const DAY = 86400000;
const START_HOUR = 8;
const END_HOUR = 17;

// Menit jam kerja di antara dua waktu (dibulatkan ke bawah).
export function workMinutesBetween(start, end) {
  const s = new Date(start).getTime() + WIB_OFFSET; // "jam dinding" WIB dalam milidetik UTC
  const e = new Date(end).getTime() + WIB_OFFSET;
  if (!(e > s)) return 0;
  let ms = 0;
  for (let day = Math.floor(s / DAY) * DAY; day < e; day += DAY) {
    const dow = new Date(day).getUTCDay(); // 0 = Minggu, 6 = Sabtu
    if (dow === 0 || dow === 6) continue;
    const from = Math.max(s, day + START_HOUR * 3600000);
    const to = Math.min(e, day + END_HOUR * 3600000);
    if (to > from) ms += to - from;
  }
  return Math.floor(ms / 60000);
}

// Menit jam kerja per kolom, dari request masuk sampai Finish; sesi yang masih berjalan dihitung sampai `now`.
// { request, on_progress, delay, total }. Revisi (Finish → kolom lain) menambah ke total.
export function stageMinutes(task, now = new Date()) {
  const out = { request: 0, on_progress: 0, delay: 0, total: 0 };
  for (const w of task.workSessions) {
    const m = workMinutesBetween(w.startedAt, w.endedAt || now);
    out[w.status] = (out[w.status] || 0) + m;
    out.total += m;
  }
  return out;
}

// Total menit dari request masuk sampai Finish (semua kolom).
export const taskTotalMinutes = (task, now = new Date()) => stageMinutes(task, now).total;

// Menit pengerjaan saja (On Progress), dipakai analitik "rata-rata waktu kerja".
export const taskWorkMinutes = (task, now = new Date()) => stageMinutes(task, now).on_progress;

export const isTimerRunning = (task) => task.workSessions.some((w) => !w.endedAt);

// "20 jam 15 menit", "45 menit", "0 menit".
export function fmtDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} menit`;
  return m ? `${h} jam ${m} menit` : `${h} jam`;
}
