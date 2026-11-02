// Anggota tim (yang boleh masuk board). Dikelola admin di halaman Anggota.
// - Mode Supabase: tabel team_members. Database menegakkan: hanya admin yang bisa mengubah,
//   dan selalu tersisa minimal satu admin aktif (trigger team_members_admin_guard).
// - Mode uji coba: localStorage, awalnya LOCAL_MEMBERS (config.js).

import { LOCAL_MEMBERS, STORAGE_MODE } from "../config";
import { db } from "./supabaseClient";

const remote = STORAGE_MODE === "supabase";
const LOCAL_KEY = "infarm_members_v8";

export const MEMBER_COLORS = ["#00843b", "#6b4e3d", "#3f3f46", "#0e7490", "#7c3aed", "#b45309", "#be185d"];

function friendly(error) {
  const msg = `${error?.message || ""} ${error?.details || ""} ${error?.code || ""}`;
  if (msg.includes("admin_terakhir")) return new Error("Harus ada minimal satu admin aktif. Tambahkan admin lain dulu.");
  if (msg.includes("duplicate key") || msg.includes("23505")) return new Error("Email ini sudah terdaftar.");
  if (msg.includes("team_members_email_check")) return new Error("Email tidak valid. Pakai huruf kecil, contoh nama@gmail.com.");
  if (msg.includes("row-level security") || msg.includes("permission denied") || msg.includes("42501")) return new Error("Hanya admin yang bisa mengubah anggota.");
  return new Error(error?.message || "Gagal menyimpan anggota. Coba lagi.");
}

const must = ({ data, error }) => {
  if (error) throw friendly(error);
  return data;
};

// ─── Mode uji coba ──────────────────────────────────────────────

export function readLocalMembers() {
  try {
    const list = JSON.parse(localStorage.getItem(LOCAL_KEY) || "null");
    return Array.isArray(list) ? list : LOCAL_MEMBERS;
  } catch {
    return LOCAL_MEMBERS;
  }
}

function writeLocal(next) {
  if (!next.some((m) => m.role === "admin" && m.active)) throw friendly({ message: "admin_terakhir" });
  localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
}

// ─── API ────────────────────────────────────────────────────────

export async function listMembers() {
  if (!remote) return [...readLocalMembers()].sort((a, b) => a.name.localeCompare(b.name));
  const { data, error } = await db().from("team_members").select("*").order("name");
  return error ? [] : data;
}

export async function addMember({ email, name, role, color }) {
  const row = { email: email.trim().toLowerCase(), name: name.trim(), role, color, active: true };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) throw new Error("Email tidak valid. Contoh: nama@gmail.com.");
  if (!row.name) throw new Error("Isi nama tampilan.");
  if (!remote) {
    const list = readLocalMembers();
    if (list.some((m) => m.email === row.email)) throw friendly({ code: "23505" });
    writeLocal([...list, row]);
    return row;
  }
  return must(await db().from("team_members").insert(row).select().single());
}

// fields: { active, role, color }. Nama tidak diubah di sini: PIC dan pengerja checklist disimpan dengan nama.
export async function updateMember(email, fields) {
  if (!remote) {
    writeLocal(readLocalMembers().map((m) => (m.email === email ? { ...m, ...fields } : m)));
    return;
  }
  must(await db().from("team_members").update(fields).eq("email", email).select().single());
}

export async function removeMember(email) {
  if (!remote) {
    writeLocal(readLocalMembers().filter((m) => m.email !== email));
    return;
  }
  must(await db().from("team_members").delete().eq("email", email));
}
