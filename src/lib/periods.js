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
  return { unit: p.unit, current, previous, prevLabel, progress: { day, days } };
}

export const within = (iso, range) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= range.from.getTime() && t < range.to.getTime();
};

// Kelompok grafik: minggu → 7 hari (Sen..Min); bulan → minggu ke-1..5 (berdasarkan tanggal).
export function bucketOf(iso, range, unit) {
  const d = new Date(iso);
  return unit === "week" ? Math.floor((startOfDay(d) - startOfDay(range.from)) / DAY) : Math.floor((d.getDate() - 1) / 7);
}

export const bucketLabels = (unit) => (unit === "week" ? ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"] : ["Mg 1", "Mg 2", "Mg 3", "Mg 4", "Mg 5"]);

const fmt = (d, year) => d.toLocaleDateString("id-ID", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}) });
// Label rentang, mis. "2 – 8 Nov 2026" atau "26 Okt – 1 Nov 2026". `to` eksklusif.
export function rangeLabel(range) {
  const end = new Date(range.to.getTime() - 1);
  const sameMonth = end.getMonth() === range.from.getMonth() && end.getFullYear() === range.from.getFullYear();
  const start = sameMonth ? String(range.from.getDate()) : fmt(range.from, range.from.getFullYear() !== end.getFullYear());
  return `${start} – ${fmt(end, true)}`;
}
