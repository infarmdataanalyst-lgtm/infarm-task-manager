// Lampiran request: foto dikompres di browser + dibuatkan thumbnail untuk kartu; PDF apa adanya.
// Foto: sisi terpanjang maks 1600px, JPEG 0.8 (foto HP 3–5 MB biasanya jadi 200–400 KB).
// Thumbnail: maks 320px, JPEG 0.7 (±20 KB) supaya board tidak memboroskan kuota transfer.

import { MAX_PDF_BYTES } from "../config";

const MAX_SIDE = 1600;
const QUALITY = 0.8;
const THUMB_SIDE = 320;
const THUMB_QUALITY = 0.7;

const loadImage = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`"${file.name}" tidak bisa dibaca sebagai gambar. Gunakan JPG, PNG, atau WEBP.`));
    };
    img.src = url;
  });

function renderJpeg(img, maxSide, quality) {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  // Latar putih supaya PNG transparan tidak jadi hitam saat diubah ke JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

export const isPdf = (file) => file.type === "application/pdf" || /\.pdf$/i.test(file.name);

// File dari input → lampiran draf: { id, name, size, type, blob, thumbBlob, previewUrl, originalSize }.
// previewUrl (object URL) hanya untuk tampilan di form; yang disimpan adalah blob.
export async function prepareAttachment(file) {
  if (isPdf(file)) {
    if (file.size > MAX_PDF_BYTES) throw new Error(`"${file.name}" lebih dari 5 MB. Kecilkan PDF-nya atau kirim lewat link Google Drive.`);
    return { id: newId(), name: file.name, size: file.size, type: "pdf", blob: file, thumbBlob: null, previewUrl: null, originalSize: file.size };
  }
  if (!file.type.startsWith("image/")) {
    throw new Error(`"${file.name}" bukan foto atau PDF. Untuk file lain, kirim lewat link Google Drive.`);
  }
  const img = await loadImage(file);
  const [blob, thumbBlob] = await Promise.all([renderJpeg(img, MAX_SIDE, QUALITY), renderJpeg(img, THUMB_SIDE, THUMB_QUALITY)]);
  const baseName = file.name.replace(/\.[^.]+$/, "") || "gambar";
  return {
    id: newId(),
    name: `${baseName}.jpg`,
    size: blob.size,
    type: "image",
    blob,
    thumbBlob,
    previewUrl: URL.createObjectURL(thumbBlob),
    originalSize: file.size,
  };
}

export const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("File tidak bisa dibaca."));
    reader.readAsDataURL(blob);
  });

export const fmtBytes = (bytes) =>
  bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
