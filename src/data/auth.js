// Login tim desain.
// - Mode Supabase: login Google (Supabase Auth). Yang boleh masuk hanya email aktif di tabel team_members;
//   database yang menegakkan ini (RLS), aplikasi hanya menampilkan pesan yang jelas.
// - Mode uji coba: memilih akun tiruan dari daftar anggota lokal (tanpa keamanan).

import { useCallback, useEffect, useState } from "react";
import { STORAGE_MODE } from "../config";
import { listMembers, readLocalMembers } from "./members";
import { db } from "./supabaseClient";

const remote = STORAGE_MODE === "supabase";
const LOCAL_KEY = "infarm_local_member";

const readLocal = () => {
  try {
    return localStorage.getItem(LOCAL_KEY);
  } catch {
    return null;
  }
};

const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

if (remote) db().auth.onAuthStateChange(() => setTimeout(emit, 0));

// Akun yang sedang login (mode uji coba): dipakai localStore untuk nama pelaku di riwayat.
export const localMember = () => readLocalMembers().find((m) => m.email === readLocal() && m.active) || null;

// Muat ulang status login + daftar anggota (mis. setelah admin mengubah anggota).
export const refreshAuth = () => emit();

async function resolve() {
  if (!remote) {
    const m = localMember();
    return m ? { status: "member", member: m, email: m.email } : { status: "signedOut" };
  }
  const { data } = await db().auth.getSession();
  const email = data.session?.user?.email;
  if (!email) return { status: "signedOut" };
  const { data: row, error } = await db().rpc("my_membership");
  if (error) return { status: "error", email, message: "Tidak bisa memeriksa akun. Periksa koneksi lalu muat ulang halaman." };
  if (!row?.email) return { status: "denied", email };
  return { status: "member", member: row, email };
}

export async function signInWithGoogle() {
  const { error } = await db().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/tim`, queryParams: { prompt: "select_account" } },
  });
  if (error) throw new Error("Tidak bisa membuka login Google. Coba lagi.");
}

export function signInLocal(email) {
  try {
    localStorage.setItem(LOCAL_KEY, email);
  } catch {}
  emit();
}

export async function signOut() {
  if (remote) await db().auth.signOut();
  else {
    try {
      localStorage.removeItem(LOCAL_KEY);
    } catch {}
  }
  emit();
}

// Hook untuk /tim: { status: "loading" | "signedOut" | "denied" | "error" | "member", member, email, members }.
export function useAuth() {
  const [state, setState] = useState({ status: "loading" });
  const refresh = useCallback(async () => {
    const next = await resolve();
    const members = next.status === "member" ? await listMembers() : [];
    setState({ ...next, members });
  }, []);
  useEffect(() => {
    refresh();
    listeners.add(refresh);
    return () => listeners.delete(refresh);
  }, [refresh]);
  return state;
}
