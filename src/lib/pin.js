import { TEAM_PIN_SHA256 } from "../config";

// PIN tim untuk halaman /tim. Yang disimpan di browser hanya hash-nya.
// Ganti PIN = ganti REACT_APP_TEAM_PIN_SHA256, semua perangkat otomatis diminta PIN baru.

const KEY = "infarm_team_pin";

export const pinRequired = () => !!TEAM_PIN_SHA256;

export async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

const read = (storage) => {
  try {
    return storage.getItem(KEY);
  } catch {
    return null;
  }
};

export const isUnlocked = () =>
  !pinRequired() || read(localStorage) === TEAM_PIN_SHA256 || read(sessionStorage) === TEAM_PIN_SHA256;

export async function unlock(pin, remember) {
  const hash = await sha256(pin);
  if (hash !== TEAM_PIN_SHA256) return false;
  try {
    (remember ? localStorage : sessionStorage).setItem(KEY, hash);
  } catch {
    // Penyimpanan diblokir (mis. mode privat): tetap boleh masuk untuk sesi ini.
  }
  return true;
}
