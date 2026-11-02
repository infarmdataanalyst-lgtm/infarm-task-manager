// Periode analitik dan pembandingnya. Minggu dimulai Senin (waktu lokal).
// Periode yang sedang berjalan ("ini") dibandingkan dengan rentang yang sama panjang di periode sebelumnya
// (mis. Sen–Rab minggu ini vs Sen–Rab minggu lalu), supaya adil. Periode yang sudah lewat dibandingkan penuh.

const DAY = 86400000;

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const startOfWeek = (d) => {
  const s = startOfDay(d);
  return new Date(s.getTime() - ((s.getDay() + 6) % 7) * DAY);
};
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);

export const PERIODS = [
  { key: "this_week", label: "Minggu ini", unit: "week" },
  { key: "last_week", label: "Minggu lalu", unit: "week" },
  { key: "this_month", label: "Bulan ini", unit: "month" },
  { key: "last_month", label: "Bulan lalu", unit: "month" },
];

// { current: {from, to}, previous: {from, to}, unit, label, prevLabel }. to = eksklusif.
export function comparePeriods(key, now = new Date()) {
  const p = PERIODS.find((x) => x.key === key) || PERIODS[0];
  if (p.unit === "week") {
    const thisWeek = startOfWeek(now);
    if (key === "this_week") {
      const elapsed = now - thisWeek;
      const prevFrom = new Date(thisWeek.getTime() - 7 * DAY);
      return { unit: "week", current: { from: thisWeek, to: now }, previous: { from: prevFrom, to: new Date(prevFrom.getTime() + elapsed) }, prevLabel: "minggu lalu" };
    }
    const from = new Date(thisWeek.getTime() - 7 * DAY);
    return { unit: "week", current: { from, to: thisWeek }, previous: { from: new Date(from.getTime() - 7 * DAY), to: from }, prevLabel: "2 minggu lalu" };
  }
  const thisMonth = startOfMonth(now);
  if (key === "this_month") {
    const prevFrom = addMonths(thisMonth, -1);
    const elapsed = now - thisMonth;
    const prevEnd = new Date(Math.min(prevFrom.getTime() + elapsed, thisMonth.getTime()));
    return { unit: "month", current: { from: thisMonth, to: now }, previous: { from: prevFrom, to: prevEnd }, prevLabel: "bulan lalu" };
  }
  const from = addMonths(thisMonth, -1);
  return { unit: "month", current: { from, to: thisMonth }, previous: { from: addMonths(thisMonth, -2), to: from }, prevLabel: "2 bulan lalu" };
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

const fmt = (d) => d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
// Label rentang, mis. "27 Okt – 29 Okt". `to` eksklusif, jadi ditampilkan sampai hari sebelumnya bila tepat tengah malam.
export function rangeLabel(range) {
  const end = range.to.getHours() === 0 && range.to.getMinutes() === 0 ? new Date(range.to.getTime() - 1) : range.to;
  return `${fmt(range.from)} – ${fmt(end)}`;
}
