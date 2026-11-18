// Supabase Edge Function "hapus-lampiran": dijalankan Cron setiap hari pukul 01.00 WIB (18.00 UTC).
//
// 1. Task Finish yang sudah >= 30 hari selesai, dan task terarsip yang sudah >= 30 hari diarsipkan:
//    a. foto ukuran penuh + PDF disalin ke Google Drive lewat Apps Script (supabase/apps-script/arsip-drive.gs),
//       satu subfolder per task di folder bulan (mis. "2026-11");
//    b. link subfolder ditambahkan ke Link referensi task ("Lampiran (Google Drive)"), lampiran dikosongkan,
//       attachments_deleted_at = sekarang (sekali simpan; riwayat ditulis database dengan pelaku "sistem");
//    c. baru setelah itu file (foto, thumbnail, PDF) dihapus dari Storage.
//    Gagal di langkah a atau b: task tidak diubah dan file tidak dihapus; dicoba lagi besok.
//    Task tidak pernah dihapus; checklist, waktu kerja, riwayat tetap ada.
// 2. Bersih-bersih (hanya mode normal):
//    - file "yatim" (folder di Storage yang tidak punya task) berumur > 1 hari dihapus;
//    - sisa file task yang lampirannya sudah dipindah (mis. hapus di langkah c gagal) dihapus.
//
// Mode uji: body {"uji": true} → hanya task yang judulnya diawali "[TESTING]", tanpa bersih-bersih.
//
// Penjaga pintu: "Verify JWT" dimatikan (Cron memakai secret key baru, bukan JWT), jadi function sendiri yang
// memeriksa pemanggil: hanya yang membawa secret key / service role key proyek (Authorization: Bearer atau apikey).
//
// Secrets (Supabase → Edge Functions → Secrets): ARSIP_URL (link Web app Apps Script), ARSIP_TOKEN (kata sandi
// bersama, sama dengan Script Properties di Apps Script). Bila belum diatur, lampiran TIDAK dihapus sama sekali.
// Kunci service role tersedia otomatis (SUPABASE_SERVICE_ROLE_KEY); jangan disalin ke mana pun.
// Cara memasang: docs/PANDUAN-ARSIP-DRIVE.md.

import { createClient } from "npm:@supabase/supabase-js@2";

const RETENTION_DAYS = 30; // sama dengan ATTACHMENT_RETENTION_DAYS di src/config.js
const ORPHAN_HOURS = 24;
const BUCKET = "references";
const BATCH = 15; // task per jalan; sisanya diproses besok
const TIME_BUDGET_MS = 110_000; // berhenti mengambil task baru setelah ±2 menit (batas Edge Function 150 detik)
const DRIVE_LABEL = "Lampiran (Google Drive)";

type Attachment = { id?: string; name?: string; type?: string; path?: string; thumbPath?: string };
type Link = { id: string; url: string; label?: string; arsip?: boolean; files?: number };
type Task = {
  id: string;
  title: string;
  requester_name: string;
  division: string;
  finished_at: string | null;
  deleted_at: string | null;
  updated_at: string;
  attachments: Attachment[];
  reference_links: Link[];
};
type Report = { mode: string; task: number; file: number; yatim: number; sisa: number; gagal: string[] };

// Semua kunci rahasia proyek yang tersedia di Edge Function: secret key baru (JSON SUPABASE_SECRET_KEYS)
// dan service role key lama.
function secretKeys(): string[] {
  const keys: string[] = [];
  try {
    const parsed = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    for (const v of Object.values(parsed)) if (typeof v === "string" && v) keys.push(v);
  } catch (_) {
    // format tidak dikenal: abaikan
  }
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) keys.push(legacy);
  return keys;
}

function authorized(req: Request): boolean {
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const apikey = (req.headers.get("apikey") || "").trim();
  return secretKeys().some((k) => k === bearer || k === apikey);
}

// Tanggal di WIB: "2026-11-10".
const wibDate = (iso: string) => new Date(new Date(iso).getTime() + 7 * 3600000).toISOString().slice(0, 10);
// Nama folder/file aman untuk Drive (tanpa garis miring, tidak terlalu panjang).
const clean = (s: string, max = 120) => s.replace(/[\/\\\n\r\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

// Nama file unik dalam satu task (dua lampiran bisa bernama sama, mis. "image.jpg").
function uniqueNames(list: Attachment[]): string[] {
  const used = new Set<string>();
  return list.map((a, i) => {
    let name = clean(a.name || (a.path || "").split("/").pop() || `lampiran-${i + 1}`, 150);
    if (used.has(name)) {
      const dot = name.lastIndexOf(".");
      name = dot > 0 ? `${name.slice(0, dot)} (${i + 1})${name.slice(dot)}` : `${name} (${i + 1})`;
    }
    used.add(name);
    return name;
  });
}

// Supabase menjalankan pekerjaan panjang di latar belakang lewat EdgeRuntime.waitUntil, sehingga Cron (timeout 5 detik)
// langsung mendapat jawaban dan pekerjaan tetap selesai. Hasilnya dicatat di Logs: hapus-lampiran {...}.
const runtime = (globalThis as unknown as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;

Deno.serve(async (req) => {
  if (!authorized(req)) {
    return Response.json({ error: "tidak diizinkan" }, { status: 401 });
  }
  let uji = false;
  try {
    uji = (await req.json())?.uji === true;
  } catch (_) {
    // body kosong = mode normal
  }
  const job = work(uji).catch((e) => {
    console.error("hapus-lampiran gagal", (e as Error).message);
    return { error: (e as Error).message };
  });
  if (runtime) {
    runtime.waitUntil(job);
    return Response.json({ mulai: true, mode: uji ? "uji" : "normal", hasil: "lihat Logs: hapus-lampiran {...}" }, { status: 202 });
  }
  return Response.json(await job);
});

async function work(uji: boolean): Promise<Report> {

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const arsipUrl = Deno.env.get("ARSIP_URL") || "";
  const arsipToken = Deno.env.get("ARSIP_TOKEN") || "";
  const started = Date.now();
  const cutoff = new Date(started - RETENTION_DAYS * 86400000).toISOString();
  const report: Report = { mode: uji ? "uji" : "normal", task: 0, file: 0, yatim: 0, sisa: 0, gagal: [] };
  const cols = "id, title, requester_name, division, finished_at, deleted_at, updated_at, attachments, reference_links";

  // 1. Task yang lampirannya sudah waktunya dipindah ke Google Drive.
  let finishedQ = db.from("tasks").select(cols)
    .eq("status", "finish").lt("finished_at", cutoff).is("attachments_deleted_at", null).neq("attachments", "[]");
  let archivedQ = db.from("tasks").select(cols)
    .not("deleted_at", "is", null).lt("deleted_at", cutoff).is("attachments_deleted_at", null).neq("attachments", "[]");
  if (uji) {
    finishedQ = finishedQ.like("title", "[TESTING]%");
    archivedQ = archivedQ.like("title", "[TESTING]%");
  }
  const [finished, archived] = await Promise.all([finishedQ.order("finished_at").limit(BATCH), archivedQ.order("deleted_at").limit(BATCH)]);
  if (finished.error || archived.error) throw new Error((finished.error || archived.error)!.message);
  const seen = new Set<string>();
  const due = [...(finished.data as Task[]), ...(archived.data as Task[])]
    .filter((t) => !seen.has(t.id) && seen.add(t.id))
    .slice(0, BATCH);

  if (due.length && (!arsipUrl || !arsipToken)) {
    // Pengaman: tanpa tujuan Google Drive, lampiran tidak boleh dihapus.
    report.gagal.push(`ARSIP_URL / ARSIP_TOKEN belum diatur: ${due.length} task menunggu, tidak ada lampiran yang dihapus`);
    due.length = 0;
  }

  for (const t of due) {
    if (Date.now() - started > TIME_BUDGET_MS) break; // sisanya besok
    const label = t.title.slice(0, 60);
    try {
      const atts = (t.attachments || []).filter((a) => a.path);
      const names = uniqueNames(atts);
      const day = wibDate((t.finished_at || t.deleted_at)!);
      const files = atts.map((a, i) => ({ name: names[i], url: db.storage.from(BUCKET).getPublicUrl(a.path!).data.publicUrl }));

      // a. Salin ke Google Drive.
      const res = await fetch(arsipUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: arsipToken,
          taskId: t.id,
          bulan: day.slice(0, 7),
          folder: clean(`${day} · ${t.title} (${t.requester_name || "-"}, ${t.division || "-"})`),
          files,
        }),
      });
      const text = await res.text();
      let out: { ok?: boolean; url?: string; saved?: number; error?: string; gagal?: string[] } = {};
      try {
        out = JSON.parse(text);
      } catch (_) {
        throw new Error(`Apps Script tidak menjawab JSON (HTTP ${res.status})`);
      }
      if (!out.ok || !out.url) throw new Error(`Apps Script: ${out.error || (out.gagal || []).join("; ") || "gagal"}`);
      if ((out.saved ?? 0) < files.length) throw new Error(`Apps Script hanya menyimpan ${out.saved} dari ${files.length} file`);

      // b. Catat di task (sekali simpan). Link tidak ditambah dua kali bila diulang.
      //    updated_at harus sama dengan saat dibaca: bila task baru saja diubah tim (mis. tambah lampiran),
      //    tidak ada yang disimpan/dihapus dan task dicoba lagi besok.
      const links = (t.reference_links || []).filter((l) => l.url !== out.url);
      links.push({ id: crypto.randomUUID(), url: out.url, label: DRIVE_LABEL, arsip: true, files: files.length });
      const upd = await db.from("tasks")
        .update({ attachments: [], attachments_deleted_at: new Date().toISOString(), reference_links: links })
        .eq("id", t.id).eq("updated_at", t.updated_at).is("attachments_deleted_at", null)
        .select("id");
      if (upd.error) throw new Error(`simpan task: ${upd.error.message}`);
      if (!upd.data?.length) throw new Error("task baru saja diubah, dicoba lagi besok (file sudah ada di Drive)");

      // c. Baru hapus dari Storage (foto, thumbnail, PDF). Gagal di sini dibersihkan pada jalan berikutnya.
      const paths = (t.attachments || []).flatMap((a) => [a.path, a.thumbPath]).filter((p): p is string => !!p);
      if (paths.length) {
        const rm = await db.storage.from(BUCKET).remove(paths);
        if (rm.error) report.gagal.push(`${label}: sudah di Drive, hapus Storage gagal (dicoba lagi besok): ${rm.error.message}`);
      }
      report.task += 1;
      report.file += files.length;
    } catch (e) {
      report.gagal.push(`${label}: ${(e as Error).message}`);
    }
  }

  // 2. Bersih-bersih (mode normal saja).
  if (!uji) {
    const { data: folders } = await db.storage.from(BUCKET).list("", { limit: 1000 });
    const names = (folders || []).filter((f) => !f.id).map((f) => f.name).filter((n) => /^[0-9a-f-]{36}$/i.test(n)); // folder = entri tanpa id
    if (names.length) {
      const { data: existing } = await db.from("tasks").select("id, attachments, attachments_deleted_at").in("id", names);
      const known = new Map((existing || []).map((r: { id: string; attachments: unknown[]; attachments_deleted_at: string | null }) => [r.id, r]));
      const orphanBefore = Date.now() - ORPHAN_HOURS * 3600000;
      const leftoverBefore = Date.now() - 3600000; // sisa file: > 1 jam (jangan sentuh upload yang sedang berjalan)
      for (const folder of names) {
        const row = known.get(folder);
        const moved = row && row.attachments_deleted_at && (!row.attachments || row.attachments.length === 0);
        if (row && !moved) continue; // task aktif dengan lampiran: jangan disentuh
        const { data: files } = await db.storage.from(BUCKET).list(folder, { limit: 100 });
        const old = (files || [])
          .filter((f) => f.id && new Date(f.created_at).getTime() < (moved ? leftoverBefore : orphanBefore))
          .map((f) => `${folder}/${f.name}`);
        if (old.length && !(await db.storage.from(BUCKET).remove(old)).error) {
          if (moved) report.sisa += old.length;
          else report.yatim += old.length;
        }
      }
    }
  }

  console.log("hapus-lampiran", JSON.stringify(report));
  return report;
}
