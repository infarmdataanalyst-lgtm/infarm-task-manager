// Kompres gambar referensi di browser sebelum disimpan/di-upload.
// Sisi terpanjang maks 1600px, JPEG kualitas 0.8 (foto HP 3–5 MB biasanya jadi 200–400 KB).

const MAX_SIDE = 1600;
const QUALITY = 0.8;

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

const dataUrlBytes = (dataUrl) => Math.round(((dataUrl.length - dataUrl.indexOf(",") - 1) * 3) / 4);

export async function compressImage(file) {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  // Latar putih supaya PNG transparan tidak jadi hitam saat diubah ke JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const dataUrl = canvas.toDataURL("image/jpeg", QUALITY);
  const baseName = file.name.replace(/\.[^.]+$/, "") || "gambar";
  return {
    id: newId(),
    name: `${baseName}.jpg`,
    size: dataUrlBytes(dataUrl),
    originalSize: file.size,
    dataUrl,
  };
}

export const fmtBytes = (bytes) =>
  bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
