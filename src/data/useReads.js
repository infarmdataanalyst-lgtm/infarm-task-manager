import { useCallback, useEffect, useState } from "react";
import { listReads, markRead as storeMarkRead } from "./taskStore";

// Task yang sudah dibuka akun ini (badge "Baru" per akun: Denny membuka tidak menghilangkan tanda untuk Arum).
export function useReads(email) {
  const [reads, setReads] = useState(null); // Set id task; null = belum dimuat
  useEffect(() => {
    let alive = true;
    listReads(email)
      .then((ids) => alive && setReads(new Set(ids)))
      .catch(() => alive && setReads(new Set()));
    return () => {
      alive = false;
    };
  }, [email]);

  const markRead = useCallback(
    async (id) => {
      if (!reads || reads.has(id)) return;
      try {
        await storeMarkRead(id, email);
        setReads((prev) => new Set([...(prev || []), id]));
      } catch {
        // Penanda baca hanya pelengkap; gagal simpan tidak mengganggu pekerjaan.
      }
    },
    [email, reads]
  );

  // "Baru" = request yang belum diambil dan belum pernah dibuka akun ini.
  const isNew = useCallback((t) => !!reads && t.status === "request" && !reads.has(t.id), [reads]);

  return { isNew, markRead };
}
