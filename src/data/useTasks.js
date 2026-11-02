import { useCallback, useEffect, useState } from "react";
import { listTasks, subscribe } from "./taskStore";

// Daftar task + pembaruan otomatis saat data berubah (tab ini atau tab lain).
// Bila gagal dimuat, `error` berisi pesannya (board tidak boleh tampil kosong diam-diam) dan `retry` mencoba lagi.
export function useTasks() {
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    listTasks()
      .then((list) => {
        if (!alive) return;
        setTasks(list);
        setError(null);
      })
      .catch((e) => {
        if (!alive) return;
        setTasks((prev) => prev || []);
        setError(e?.message || "Daftar task gagal dimuat.");
      });
    const unsubscribe = subscribe((list) => {
      if (!alive) return;
      setTasks(list);
      setError(null);
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [attempt]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { tasks: tasks || [], loading: tasks === null, error, retry };
}
