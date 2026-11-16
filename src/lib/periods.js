// Periode analitik dan pembandingnya. Minggu = Senin–Minggu, bulan = bulan kalender (waktu lokal).
// Periode selalu penuh dan dibandingkan dengan periode penuh tepat sebelumnya:
// Minggu ini (2–8 Nov) vs minggu lalu (26 Okt – 1 Nov); Bulan ini (1–30 Nov) vs bulan lalu (1–31 Okt).
// Selama periode ini belum selesai, angkanya masih bisa bertambah (lihat `progress`).

const DAY = 86400000;

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfWeek = (d) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);

export const PERIODS = [
  { key: "this_week", label: "Minggu ini", unit: "week" },
  { key: "this_month", label: "Bulan ini", unit: "month" },
];

// { unit, current: {from, to}, previous: {from, to}, prevLabel, progress: {day, days} }. `to` eksklusif.
export function comparePeriods(key, now = new Date()) {
  const p = PERIODS.find((x) => x.key === key) || PERIODS[0];
  let current, previous, prevLabel;
  if (p.unit === "week") {
    const from = startOfWeek(now);
    current = { from, to: addDays(from, 7) };
    previous = { from: addDays(from, -7), to: from };
    prevLabel = "minggu lalu";
  } else {
    const from = startOfMonth(now);
    current = { from, to: addMonths(from, 1) };
    previous = { from: addMonths(from, -1), to: from };
    prevLabel = "bulan lalu";
  }
  const days = Math.round((current.to - current.from) / DAY);
  const day = Math.floor((startOfDay(now) - current.from) / DAY) + 1;
  return { unit: p.unit, current, previous, prevLabel, progress: { day, days, running: true } };
}

// ─── Rentang tanggal pilihan (laporan mingguan, dll.) ───────────

export const MAX_CUSTOM_DAYS = 366;
const pad = (n) => String(n).padStart(2, "0");
export const toYmd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseYmd = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.getMonth() === +m[2] - 1 ? d : null;
};

// Cek rentang dari URL/isian: null bila valid, selain itu pesan kesalahan.
export function rangeError(fromYmd, toYmd) {
  const from = parseYmd(fromYmd);
  const to = parseYmd(toYmd);
  if (!from || !to) return "Isi tanggal mulai dan tanggal akhir.";
  if (to < from) return "Tanggal akhir tidak boleh sebelum tanggal mulai.";
  if ((to - from) / DAY + 1 > MAX_CUSTOM_DAYS) return "Rentang maksimal 1 tahun.";
  return null;
}

// Rentang pilihan (inklusif kedua ujung) dibanding rentang sama panjang tepat sebelumnya.
// Grafik per hari bila ≤ 31 hari ("days"), per 7 hari bila lebih ("weeks").
export function customPeriods(fromYmd, toYmdStr, now = new Date()) {
  const from = parseYmd(fromYmd);
  const to = addDays(parseYmd(toYmdStr), 1);
  const days = Math.round((to - from) / DAY);
  const current = { from, to };
  const previous = { from: addDays(from, -days), to: from };
  const running = now >= from && now < to;
  const day = Math.min(days, Math.floor((startOfDay(now) - from) / DAY) + 1);
  return { unit: days <= 31 ? "days" : "weeks", custom: true, current, previous, prevLabel: "periode sebelumnya", progress: { day, days, running } };
}

// Pilihan cepat di panel tanggal (laporan mingguan = Senin–Minggu lalu).
export function rangePresets(now = new Date()) {
  const today = startOfDay(now);
  const week = startOfWeek(now);
  const month = startOfMonth(now);
  const r = (key, label, from, to) => ({ key, label, from: toYmd(from), to: toYmd(to) });
  return [
    r("last_week", "Minggu lalu", addDays(week, -7), addDays(week, -1)),
    r("last_7", "7 hari terakhir", addDays(today, -6), today),
    r("last_14", "2 minggu terakhir", addDays(today, -13), today),
    r("last_month", "Bulan lalu", addMonths(month, -1), addDays(month, -1)),
    r("last_30", "30 hari terakhir", addDays(today, -29), today),
  ];
}

export const within = (iso, range) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= range.from.getTime() && t < range.to.getTime();
};

// Kelompok grafik: minggu → 7 hari (Sen..Min); bulan → minggu ke-1..5 (berdasarkan tanggal);
// rentang pilihan: "days" → per hari, "weeks" → per 7 hari sejak tanggal mulai.
export function bucketOf(iso, range, unit) {
  const d = new Date(iso);
  const idx = Math.floor((startOfDay(d) - startOfDay(range.from)) / DAY);
  if (unit === "week" || unit === "days") return idx;
  if (unit === "weeks") return Math.floor(idx / 7);
  return Math.floor((d.getDate() - 1) / 7);
}

export function bucketLabels(unit, range) {
  if (unit === "week") return ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
  if (unit === "month") return ["Mg 1", "Mg 2", "Mg 3", "Mg 4", "Mg 5"];
  const days = Math.round((range.to - range.from) / DAY);
  if (unit === "weeks") return Array.from({ length: Math.ceil(days / 7) }, (_, i) => `Mg ${i + 1}`);
  return Array.from({ length: days }, (_, i) => {
    const d = addDays(range.from, i);
    return days <= 7 ? `${shortDayName(d)} ${d.getDate()}` : String(d.getDate());
  });
}
const shortDayName = (d) => ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"][d.getDay()];

const fmt = (d, year) => d.toLocaleDateString("id-ID", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}) });
// Label rentang, mis. "2 – 8 Nov 2026" atau "26 Okt – 1 Nov 2026". `to` eksklusif.
export function rangeLabel(range) {
  const end = new Date(range.to.getTime() - 1);
  const sameMonth = end.getMonth() === range.from.getMonth() && end.getFullYear() === range.from.getFullYear();
  const start = sameMonth ? String(range.from.getDate()) : fmt(range.from, range.from.getFullYear() !== end.getFullYear());
  return `${start} – ${fmt(end, true)}`;
}

// ─── Untuk grafik dan tooltip ───────────────────────────────────

// Jumlah hari dalam rentang (Minggu ini = 7, Bulan ini = 28–31).
export const dayCount = (range) => Math.round((startOfDay(new Date(range.to.getTime() - 1)) - startOfDay(range.from)) / DAY) + 1;

// Hari ke-berapa (0 = hari pertama rentang) untuk sebuah waktu.
export const dayIndex = (iso, range) => Math.floor((startOfDay(new Date(iso)) - startOfDay(range.from)) / DAY);

// Tanggal hari ke-i dalam rentang.
export const dayAt = (range, i) => addDays(startOfDay(range.from), i);

const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const short = (d) => d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
const shortDay = (d) => DAY_NAMES[d.getDay()].slice(0, 3);

// Judul tooltip untuk satu kelompok grafik, mis. "Rabu, 4 Nov 2026" (minggu) atau "Minggu ke-2 · 8–14 Nov" (bulan).
export function bucketTitle(range, unit, i) {
  if (unit === "weeks") {
    const first = dayAt(range, i * 7);
    const last = new Date(Math.min(addDays(first, 6).getTime(), range.to.getTime() - 1));
    return `Minggu ke-${i + 1} · ${short(first)} – ${short(last)}`;
  }
  if (unit === "week" || unit === "days") {
    const d = dayAt(range, i);
    return `${DAY_NAMES[d.getDay()]}, ${d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`;
  }
  const first = new Date(range.from.getFullYear(), range.from.getMonth(), i * 7 + 1);
  const lastDay = Math.min(i * 7 + 7, dayCount(range));
  const last = new Date(range.from.getFullYear(), range.from.getMonth(), lastDay);
  return `Minggu ke-${i + 1} · ${first.getDate()}–${short(last)}`;
}

// Label pendek kelompok pembanding, mis. "Rab, 28 Okt" (minggu) atau "Mg 2" (bulan).
export function bucketShort(range, unit, i) {
  if (unit === "weeks") return `Mg ${i + 1}`;
  if (unit === "week" || unit === "days") {
    const d = dayAt(range, i);
    return `${shortDay(d)}, ${short(d)}`;
  }
  return `Mg ${i + 1}`;
}

// Tanggal panjang untuk tooltip grafik garis, mis. "Rabu, 4 Nov 2026".
export const longDate = (d) => `${DAY_NAMES[d.getDay()]}, ${d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`;
