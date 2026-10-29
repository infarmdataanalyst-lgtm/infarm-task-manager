// Utilitas tanggal. dueDate disimpan "YYYY-MM-DD" (tanggal lokal),
// timestamp lain (createdAt, finishedAt, ...) disimpan ISO string.

const DAY = 86400000;

export const parseDay = (ymd) => {
  if (!ymd) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const today = () => startOfDay(new Date());

export const toYMD = (date) => {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const fmt = (date, opts) => new Date(date).toLocaleDateString("id-ID", opts);

export const fmtDay = (ymd) => (ymd ? fmt(parseDay(ymd), { day: "numeric", month: "short", year: "numeric" }) : "-");
export const fmtShort = (iso) => (iso ? fmt(iso, { day: "numeric", month: "short" }) : "-");
export const fmtDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "-";

// Selisih hari kalender (b - a), dibulatkan.
export const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY);

export const isOverdue = (task) => task.status !== "finish" && !!task.dueDate && parseDay(task.dueDate) < today();

export const daysLate = (task) => (isOverdue(task) ? daysBetween(parseDay(task.dueDate), today()) : 0);

// Deadline hari ini atau besok (dan belum selesai).
export const isDueSoon = (task) => {
  if (task.status === "finish" || !task.dueDate) return false;
  const diff = daysBetween(today(), parseDay(task.dueDate));
  return diff === 0 || diff === 1;
};

export const dueSoonLabel = (task) => (daysBetween(today(), parseDay(task.dueDate)) === 0 ? "Deadline hari ini" : "Deadline besok");

// Selesai tepat waktu = tanggal pindah ke Finish tidak melewati deadline.
export const finishedOnTime = (task) =>
  !!task.finishedAt && (!task.dueDate || startOfDay(task.finishedAt) <= parseDay(task.dueDate));

export const inRange = (iso, range) => {
  if (!iso) return false;
  const d = new Date(iso);
  return d >= range.from && d <= range.to;
};

// Rentang periode untuk Analitik. custom: { from: "YYYY-MM-DD", to: "YYYY-MM-DD" }.
export const periodRange = (period, custom) => {
  const now = new Date();
  const endOfToday = new Date(today().getTime() + DAY - 1);
  if (period === "this_month") {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfToday };
  }
  if (period === "last_month") {
    return {
      from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      to: new Date(new Date(now.getFullYear(), now.getMonth(), 1).getTime() - 1),
    };
  }
  if (period === "custom" && custom?.from && custom?.to) {
    return { from: parseDay(custom.from), to: new Date(parseDay(custom.to).getTime() + DAY - 1) };
  }
  return { from: new Date(today().getTime() - 29 * DAY), to: endOfToday };
};
