// Supabase Edge Function "hapus-lampiran": dijalankan Cron setiap hari pukul 01.00 WIB (18.00 UTC).
//
// 1. Task Finish yang sudah >= 30 hari selesai, dan task terarsip yang sudah >= 30 hari diarsipkan:
//    file lampirannya (foto, thumbnail, PDF) dihapus dari Storage lewat Storage API, lalu task diperbarui
//    (attachments = [], attachments_deleted_at = sekarang). Database mencatat riwayat "lampiran_dihapus"
//    dengan pelaku "sistem". Baris task, link referensi, link hasil, checklist, dan waktu kerja tetap ada.
// 2. File "yatim" (folder di Storage yang tidak punya task, mis. upload berhasil tapi request gagal terkirim)
//    yang berumur > 1 hari ikut dihapus.
//
// Aman dipanggil berkali-kali: hanya file yang memenuhi syarat yang dihapus.
// Kunci service role tersedia otomatis di Edge Function (SUPABASE_SERVICE_ROLE_KEY); jangan disalin ke mana pun.
// Cara memasang: docs/PANDUAN-SUPABASE.md, bagian "Hapus lampiran otomatis".

import { createClient } from "npm:@supabase/supabase-js@2";

const RETENTION_DAYS = 30; // sama dengan ATTACHMENT_RETENTION_DAYS di src/config.js
const ORPHAN_HOURS = 24;
const BUCKET = "references";
const BATCH = 100; // task per jalan; sisanya diproses besok

type Attachment = { path?: string; thumbPath?: string };
type Task = { id: string; title: string; attachments: Attachment[] };

Deno.serve(async () => {
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400000).toISOString();
  const report = { task: 0, file: 0, yatim: 0, gagal: [] as string[] };

  // 1. Task yang lampirannya sudah waktunya dihapus.
  const finished = await db.from("tasks").select("id, title, attachments")
    .eq("status", "finish").lt("finished_at", cutoff).is("attachments_deleted_at", null).neq("attachments", "[]").limit(BATCH);
  const archived = await db.from("tasks").select("id, title, attachments")
    .not("deleted_at", "is", null).lt("deleted_at", cutoff).is("attachments_deleted_at", null).neq("attachments", "[]").limit(BATCH);
  if (finished.error || archived.error) {
    return Response.json({ error: (finished.error || archived.error)!.message }, { status: 500 });
  }
  const seen = new Set<string>();
  const due = [...(finished.data as Task[]), ...(archived.data as Task[])].filter((t) => !seen.has(t.id) && seen.add(t.id));

  for (const t of due) {
    const paths = (t.attachments || []).flatMap((a) => [a.path, a.thumbPath]).filter((p): p is string => !!p);
    if (paths.length) {
      const { error } = await db.storage.from(BUCKET).remove(paths);
      if (error) {
        report.gagal.push(`${t.title}: ${error.message}`);
        continue; // task tidak diubah supaya dicoba lagi besok
      }
    }
    const { error } = await db.from("tasks").update({ attachments: [], attachments_deleted_at: new Date().toISOString() }).eq("id", t.id);
    if (error) {
      report.gagal.push(`${t.title}: ${error.message}`);
      continue;
    }
    report.task += 1;
    report.file += paths.length;
  }

  // 2. File yatim: folder <id task> yang task-nya tidak ada di database.
  const { data: folders } = await db.storage.from(BUCKET).list("", { limit: 1000 });
  const names = (folders || []).filter((f) => !f.id).map((f) => f.name); // folder = entri tanpa id
  if (names.length) {
    const { data: existing } = await db.from("tasks").select("id").in("id", names.filter((n) => /^[0-9a-f-]{36}$/i.test(n)));
    const known = new Set((existing || []).map((r: { id: string }) => r.id));
    const orphanBefore = Date.now() - ORPHAN_HOURS * 3600000;
    for (const folder of names.filter((n) => !known.has(n))) {
      const { data: files } = await db.storage.from(BUCKET).list(folder, { limit: 100 });
      const old = (files || []).filter((f) => f.id && new Date(f.created_at).getTime() < orphanBefore).map((f) => `${folder}/${f.name}`);
      if (old.length && !(await db.storage.from(BUCKET).remove(old)).error) report.yatim += old.length;
    }
  }

  console.log("hapus-lampiran", JSON.stringify(report));
  return Response.json(report);
});
