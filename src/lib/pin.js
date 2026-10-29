import { STORAGE_MODE, TEAM_PIN_SHA256 } from "../config";
import { checkPin } from "../data/supabaseStore";

// PIN tim untuk halaman /tim.
// - Mode Supabase: PIN dicek di server (fungsi team_check_pin) dan dikirim di setiap aksi tim,
//   jadi PIN-nya sendiri yang disimpan di browser (bukan hash).
// - Mode lokal: dibandingkan dengan REACT_APP_TEAM_PIN_SHA256 (hanya penghalang di UI).

const KEY = "infarm_team_pin_v2";
const remote = STORAGE_MODE === "supabase";

export const pinRequired = () => remote || !!TEAM_PIN_SHA256;

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

let sessionPin = null;

export const getPin = () => sessionPin || read(sessionStorage) || read(localStorage) || "";

export function clearPin() {
  sessionPin = null;
  for (const storage of [localStorage, sessionStorage]) {
    try {
      storage.removeItem(KEY);
    } catch {
      // abaikan
    }
  }
}

// Mode Supabase: PIN tersimpan dianggap benar; kalau ternyata salah/ganti, aksi pertama
// ditolak server dan layar PIN muncul lagi (event "infarm:pin-invalid").
export const isUnlocked = async () => {
  if (!pinRequired()) return true;
  const pin = getPin();
  if (!pin) return false;
  return remote ? true : (await sha256(pin)) === TEAM_PIN_SHA256;
};

export async function unlock(pin, remember) {
  const ok = remote ? await checkPin(pin) : (await sha256(pin)) === TEAM_PIN_SHA256;
  if (!ok) return false;
  sessionPin = pin;
  try {
    (remember ? localStorage : sessionStorage).setItem(KEY, pin);
  } catch {
    // Penyimpanan diblokir (mis. mode privat): PIN tetap dipakai untuk sesi ini.
  }
  return true;
}
