/**
 * Apps Script "Arsip lampiran Infarm Design Task".
 *
 * Dipanggil oleh Supabase Edge Function hapus-lampiran (bukan oleh trigger): menyimpan foto/PDF satu task
 * ke Google Drive, lalu mengirim balik link subfoldernya. Tidak menyentuh Supabase selain mengunduh file publik.
 *
 * Pasang di script.google.com dengan akun PEMILIK folder tujuan, lalu Deploy → New deployment → Web app:
 *   Execute as: Me · Who has access: Anyone.
 * Project Settings → Script Properties:
 *   ARSIP_TOKEN = kata sandi bersama (sama dengan Secret ARSIP_TOKEN di Supabase)
 *   FOLDER_ID   = ID folder induk di Google Drive (bagian setelah /folders/ di link folder)
 * Panduan lengkap: docs/PANDUAN-ARSIP-DRIVE.md
 *
 * Isi folder:  <folder induk>/2026-11/2026-11-10 · Judul (Requester, Divisi)/foto.jpg ...
 * Subfolder task dikenali dari ID task (disimpan di deskripsi folder), jadi bila diulang tidak dibuat dua kali;
 * file yang namanya sudah ada di subfolder dilewati.
 */

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'body bukan JSON' });
  }
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('ARSIP_TOKEN');
  if (!token || body.token !== token) return json_({ ok: false, error: 'kata sandi salah' });

  var lock = LockService.getScriptLock();
  lock.waitLock(30000); // satu task sekali jalan, supaya folder tidak dobel
  try {
    var induk = DriveApp.getFolderById(props.getProperty('FOLDER_ID'));
    var bulan = cariAtauBuat_(induk, String(body.bulan || 'tanpa-bulan'), null);
    var folder = cariAtauBuat_(bulan, String(body.folder || body.taskId), String(body.taskId || ''));

    var ada = {};
    var it = folder.getFiles();
    while (it.hasNext()) ada[it.next().getName()] = true;

    var saved = 0;
    var gagal = [];
    (body.files || []).forEach(function (f) {
      if (ada[f.name]) { saved++; return; } // sudah tersimpan pada percobaan sebelumnya
      try {
        var res = UrlFetchApp.fetch(f.url, { muteHttpExceptions: true });
        if (res.getResponseCode() !== 200) throw new Error('HTTP ' + res.getResponseCode());
        folder.createFile(res.getBlob().setName(f.name));
        saved++;
      } catch (err) {
        gagal.push(f.name + ': ' + err.message);
      }
    });
    return json_({ ok: gagal.length === 0, url: folder.getUrl(), saved: saved, gagal: gagal });
  } catch (err) {
    return json_({ ok: false, error: err.message });
  } finally {
    lock.releaseLock();
  }
}

// Cek cepat dari browser: membuka link Web app menampilkan {"ok":true,...}.
function doGet() {
  return json_({ ok: true, info: 'Arsip lampiran Infarm Design Task aktif' });
}

// Subfolder dikenali dari ID (deskripsi folder) bila ada, kalau tidak dari nama.
function cariAtauBuat_(induk, nama, id) {
  var it = induk.getFolders();
  while (it.hasNext()) {
    var f = it.next();
    if (id ? f.getDescription() === id : f.getName() === nama) return f;
  }
  var baru = induk.createFolder(nama);
  if (id) baru.setDescription(id);
  return baru;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Jalankan sekali dari editor (pilih fungsi ini → Run) untuk memberi izin Drive + UrlFetch dan memeriksa pengaturan.
function cekPengaturan() {
  var props = PropertiesService.getScriptProperties();
  var folder = DriveApp.getFolderById(props.getProperty('FOLDER_ID'));
  Logger.log('Folder induk: ' + folder.getName() + ' (' + folder.getUrl() + ')');
  Logger.log('ARSIP_TOKEN: ' + (props.getProperty('ARSIP_TOKEN') ? 'terisi' : 'BELUM DIISI'));
  UrlFetchApp.fetch('https://www.google.com', { muteHttpExceptions: true });
  Logger.log('Siap.');
}
