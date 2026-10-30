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

// Total menit kerja task dari sesi-sesinya; sesi yang masih berjalan dihitung sampai `now`.
export const taskWorkMinutes = (task, now = new Date()) =>
  task.workSessions.reduce((sum, w) => sum + workMinutesBetween(w.startedAt, w.endedAt || now), 0);

export const isTimerRunning = (task) => task.workSessions.some((w) => !w.endedAt);

// "20 jam 15 menit", "45 menit", "0 menit".
export function fmtDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} menit`;
  return m ? `${h} jam ${m} menit` : `${h} jam`;
}
