// Satu klien Supabase untuk seluruh aplikasi. Sesi login Google disimpan di browser
// dan diperbarui otomatis; setelah kembali dari Google, sesi dibaca dari URL.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "../config";

let client = null;

export const db = () => {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
};
