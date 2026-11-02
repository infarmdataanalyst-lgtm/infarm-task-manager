import { useEffect, useState } from "react";
import { listTasks, subscribe } from "./taskStore";

// Daftar task + pembaruan otomatis saat data berubah (tab ini atau tab lain).
export function useTasks() {
  const [tasks, setTasks] = useState(null);
  useEffect(() => {
    let alive = true;
    listTasks()
      .then((list) => alive && setTasks(list))
      .catch(() => alive && setTasks([])); // mis. sesi berakhir; daftar diisi ulang lewat subscribe setelah login lagi
    const unsubscribe = subscribe((list) => alive && setTasks(list));
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);
  return { tasks: tasks || [], loading: tasks === null };
}
