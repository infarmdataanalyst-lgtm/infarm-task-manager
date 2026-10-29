// /tim/* — kerangka halaman tim desain: kunci PIN, header, tab Kanban/Analitik.

import React, { useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { ArrowRight, Copy, Download, LayoutList } from "lucide-react";
import { useTasks } from "../../data/useTasks";
import { downloadCsv } from "../../lib/csv";
import { isUnlocked, pinRequired, unlock } from "../../lib/pin";
import { AppHeader, LocalModeBanner, useToast } from "../../components/ui";

const PIN_LENGTH = 6;

function PinScreen({ onUnlocked }) {
  const [digits, setDigits] = useState(Array(PIN_LENGTH).fill(""));
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);
  const refs = useRef([]);

  const setDigit = (i, value) => {
    const clean = value.replace(/\D/g, "");
    const next = [...digits];
    if (clean.length > 1) {
      // Tempel PIN sekaligus.
      clean.slice(0, PIN_LENGTH - i).split("").forEach((d, k) => (next[i + k] = d));
      setDigits(next);
      refs.current[Math.min(i + clean.length, PIN_LENGTH - 1)]?.focus();
    } else {
      next[i] = clean;
      setDigits(next);
      if (clean && i < PIN_LENGTH - 1) refs.current[i + 1]?.focus();
    }
    setError(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    const pin = digits.join("");
    if (pin.length < PIN_LENGTH) return setError(true);
    setChecking(true);
    const ok = await unlock(pin, remember);
    setChecking(false);
    if (ok) onUnlocked();
    else {
      setError(true);
      setDigits(Array(PIN_LENGTH).fill(""));
      refs.current[0]?.focus();
    }
  };

  return (
    <main className="pin-page">
      <div style={{ width: "100%", maxWidth: 420 }} className="stack-lg">
        <form className="card card-pad-lg stack-lg" style={{ padding: "28px 24px", boxShadow: "var(--shadow-lg)" }} onSubmit={submit}>
          <div className="stack" style={{ alignItems: "center", textAlign: "center" }}>
            <span className="brand-logo" style={{ width: 56, height: 56, border: "1px solid var(--brand-light)", background: "var(--brand-surface)" }}>
              <img src="/logo-infarm.png" alt="Logo Infarm" />
            </span>
            <h1 style={{ fontSize: 20 }}>Board tim desain</h1>
            <p className="muted">Masukkan PIN tim untuk mengelola task.</p>
          </div>
          <fieldset style={{ border: 0, margin: 0, padding: 0 }} className="stack">
            <legend className="label" style={{ padding: 0, marginBottom: 8 }}>PIN tim ({PIN_LENGTH} angka)</legend>
            <div className={`pin-digits ${error ? "invalid" : ""}`}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => (refs.current[i] = el)}
                  type="password"
                  inputMode="numeric"
                  autoComplete={i === 0 ? "one-time-code" : "off"}
                  aria-label={`Digit PIN ${i + 1}`}
                  value={d}
                  autoFocus={i === 0}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onKeyDown={(e) => e.key === "Backspace" && !d && i > 0 && refs.current[i - 1]?.focus()}
                />
              ))}
            </div>
            {error && <p className="error-text" role="alert">PIN salah atau belum lengkap. Coba lagi.</p>}
            <label className="row" style={{ minHeight: 44, color: "var(--zinc-700)" }}>
              <input type="checkbox" className="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              Ingat di perangkat ini
            </label>
          </fieldset>
          <button type="submit" className="btn btn-primary btn-cta" disabled={checking}>{checking ? "Memeriksa…" : "Masuk"}</button>
          <p className="small muted" style={{ textAlign: "center" }}>Lupa PIN? Tanya Denny atau Arum.</p>
        </form>
        <Link to="/" className="row" style={{ justifyContent: "center", minHeight: 44, fontWeight: 600, textDecoration: "none" }}>
          Bukan tim desain? Lihat status request <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </main>
  );
}

export default function TeamLayout() {
  const [unlocked, setUnlocked] = useState(isUnlocked);
  const { tasks } = useTasks();
  const [toast, showToast] = useToast();
  const { pathname } = useLocation();
  const onAnalytics = pathname.startsWith("/tim/analitik");

  if (!unlocked) return <PinScreen onUnlocked={() => setUnlocked(true)} />;

  const copyRequestLink = async () => {
    const url = `${window.location.origin}/request`;
    try {
      await navigator.clipboard.writeText(url);
      showToast(`Link form request disalin: ${url}`);
    } catch {
      showToast(`Salin link ini secara manual: ${url}`, "error");
    }
  };

  return (
    <>
      <AppHeader title="Design Task Manager" subtitle="infarm.id · Tim Desain: Denny & Arum" to="/tim">
        <Link to="/" className="btn btn-on-green" aria-label="Halaman status">
          <LayoutList size={16} aria-hidden="true" /> <span className="btn-label">Halaman status</span>
        </Link>
        <button type="button" className="btn btn-on-green" onClick={copyRequestLink} aria-label="Salin link form request">
          <Copy size={16} aria-hidden="true" /> <span className="btn-label">Salin link form request</span>
        </button>
        <button type="button" className="btn btn-ghost-light" onClick={() => downloadCsv(tasks)} aria-label="Export CSV">
          <Download size={16} aria-hidden="true" /> <span className="btn-label">Export CSV</span>
        </button>
      </AppHeader>
      <main className="container page">
        {!pinRequired() && (
          <p className="local-banner" role="note">
            PIN tim belum diatur, jadi halaman ini terbuka untuk siapa saja yang tahu link-nya. Atur REACT_APP_TEAM_PIN_SHA256 di Vercel.
          </p>
        )}
        <LocalModeBanner />
        <nav className="tabs" aria-label="Tampilan" style={{ alignSelf: "flex-start" }}>
          <Link to="/tim" className={`tab ${onAnalytics ? "" : "active"}`} aria-current={onAnalytics ? undefined : "page"}>
            Kanban
          </Link>
          <Link to="/tim/analitik" className={`tab ${onAnalytics ? "active" : ""}`} aria-current={onAnalytics ? "page" : undefined}>
            Analitik
          </Link>
        </nav>
        <Outlet context={{ tasks, showToast }} />
      </main>
      {toast}
    </>
  );
}
