// Validasi dan tampilan link (referensi & hasil desain).

export const normalizeUrl = (raw) => {
  const value = (raw || "").trim();
  if (!value) return null;
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    return url.hostname.includes(".") ? url.toString() : null;
  } catch {
    return null;
  }
};

// Tampilkan link tanpa "https://" dan "www." supaya ringkas.
export const displayUrl = (url) => url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
