// /tim/* — kerangka halaman tim desain: login Google, header (cari judul, salin link form, export, akun),
// tab Kanban/Analitik (HP: menu bawah). Data board hanya bisa dibaca anggota (ditegakkan database).

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { BarChart3, ChevronDown, Copy, Download, LayoutDashboard, LogOut, Search, UserRound } from "lucide-react";
import { LOCAL_MEMBERS, STORAGE_MODE } from "../../config";
import { signInLocal, signInWithGoogle, signOut, useAuth } from "../../data/auth";
import { useTasks } from "../../data/useTasks";
import { downloadCsv } from "../../lib/csv";
import { AppHeader, Avatar, LocalModeBanner, Modal, useToast } from "../../components/ui";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.8-2.1 5.1-4.4 6.6v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.1z" />
      <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.1 15.5 46 24 46z" />
      <path fill="#FBBC05" d="M11.8 28.3c-.4-1.3-.7-2.8-.7-4.3s.3-3 .7-4.3V14H4.5C3 17 2 20.4 2 24s1 7 2.5 10l7.3-5.7z" />
      <path fill="#EA4335" d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.2 29.9 2 24 2 15.5 2 8.1 6.9 4.5 14l7.3 5.7c1.7-5.2 6.5-8.9 12.2-8.9z" />
    </svg>
  );
}

function LoginScreen({ auth }) {
  const [error, setError] = useState("");
  const login = async () => {
    setError("");
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <span className="brand-logo" style={{ width: 56, height: 56, borderRadius: 16, background: "var(--brand-surface)", border: "1px solid var(--brand-light)" }}>
          <img src="/logo-infarm.png" alt="Logo Infarm" />
        </span>
        <div>
          <h1 id="login-title" className="h-page">Design Task Hub</h1>
          <p className="muted" style={{ marginTop: 4 }}>Khusus Tim Desain infarm.id. Masuk dengan akun Google yang sudah didaftarkan admin.</p>
        </div>
        {auth.status === "denied" && (
          <p role="alert" className="alert-error">
            <strong>{auth.email} belum terdaftar.</strong> Board ini hanya untuk tim desain. Untuk mengirim request, pakai form request.
            Kalau kamu anggota tim, minta SPV menambahkan email ini.
          </p>
        )}
        {auth.status === "error" && <p role="alert" className="alert-error">{auth.message}</p>}
        {error && <p role="alert" className="alert-error">{error}</p>}
        {STORAGE_MODE === "supabase" ? (
          <>
            {auth.status === "denied" || auth.status === "error" ? (
              <button type="button" className="google-btn" onClick={() => signOut().then(login)}>
                <GoogleIcon /> Masuk dengan akun Google lain
              </button>
            ) : (
              <button type="button" className="google-btn" onClick={login}>
                <GoogleIcon /> Masuk dengan Google
              </button>
            )}
            <p className="small muted">Sesi diingat di perangkat ini sampai kamu keluar.</p>
          </>
        ) : (
          <div className="stack" style={{ width: "100%" }}>
            <LocalModeBanner />
            {LOCAL_MEMBERS.map((m) => (
              <button key={m.email} type="button" className="google-btn" onClick={() => signInLocal(m.email)}>
                <Avatar name={m.name} color={m.color} size={24} /> Masuk sebagai {m.name}{m.role === "admin" ? " (admin)" : ""}
              </button>
            ))}
          </div>
        )}
        <Link to="/" className="small" style={{ fontWeight: 600 }}>Mau mengirim request desain? Buka form request</Link>
      </section>
    </main>
  );
}

function AccountMenu({ auth, onCopy, onExport, mobile, onClose }) {
  const content = (
    <>
      <div className="row" style={{ gap: 10, padding: "6px 10px 10px", borderBottom: "1px solid var(--zinc-100)", marginBottom: 4, flexWrap: "nowrap" }}>
        <Avatar name={auth.member.name} color={auth.member.color} size={36} />
        <span style={{ minWidth: 0 }}>
          <strong style={{ display: "block" }}>{auth.member.name}{auth.member.role === "admin" ? " · admin" : ""}</strong>
          <span className="small muted" style={{ overflowWrap: "anywhere" }}>{auth.email}</span>
        </span>
      </div>
      {mobile && (
        <>
          <button type="button" className="menu-item" onClick={onCopy}><Copy size={16} aria-hidden="true" /> Salin link form request</button>
          <button type="button" className="menu-item" onClick={onExport}><Download size={16} aria-hidden="true" /> Export CSV</button>
        </>
      )}
      <button type="button" className="menu-item" style={{ color: "var(--rose-700)" }} onClick={signOut}><LogOut size={16} aria-hidden="true" /> Keluar</button>
    </>
  );
  if (mobile) {
    return (
      <Modal labelledBy="akun-judul" onClose={onClose}>
        <h2 id="akun-judul" className="sr-only">Akun</h2>
        <div className="stack" style={{ gap: 2 }}>{content}</div>
      </Modal>
    );
  }
  return <div className="menu" role="menu">{content}</div>;
}

export default function TeamLayout() {
  const auth = useAuth();
  if (auth.status === "loading") return <main className="login-page" aria-busy="true" />;
  if (auth.status !== "member") return <LoginScreen auth={auth} />;
  return <TeamApp auth={auth} />;
}

// Hanya dirender setelah login sebagai anggota, jadi data task baru dimuat saat aksesnya ada.
function TeamApp({ auth }) {
  const { tasks: allTasks } = useTasks();
  const [toast, showToast] = useToast();
  const { pathname } = useLocation();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const menuRef = useRef(null);
  const onAnalytics = pathname.startsWith("/tim/analitik");

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (e) => !menuRef.current?.contains(e.target) && setMenuOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const members = useMemo(() => (auth.members || []).filter((m) => m.active), [auth.members]);
  const designers = useMemo(() => members.filter((m) => m.role === "designer"), [members]);
  const tasks = useMemo(() => allTasks.filter((t) => !t.deletedAt), [allTasks]);

  const colorOf = (name) => members.find((m) => m.name === name)?.color || "#6b7280";

  const copyRequestLink = async () => {
    const url = `${window.location.origin}/`;
    setSheetOpen(false);
    try {
      await navigator.clipboard.writeText(url);
      showToast(`Link form request disalin: ${url}`);
    } catch {
      showToast(`Salin link ini secara manual: ${url}`, "error");
    }
  };
  const exportCsv = () => {
    setSheetOpen(false);
    downloadCsv(tasks);
  };

  const search = (
    <div className={`header-center ${searchOpen ? "" : "closed"}`}>
      <label className="header-search">
        <Search size={16} aria-hidden="true" />
        <span className="sr-only">Cari judul task</span>
        <input type="search" placeholder="Cari judul task" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
    </div>
  );

  return (
    <>
      <AppHeader title="Design Task Hub" subtitle="infarm.id · Tim Desain" to="/tim" center={search}>
        <button type="button" className="btn btn-on-green show-mobile" aria-label="Cari judul task" aria-expanded={searchOpen} onClick={() => setSearchOpen(!searchOpen)}>
          <Search size={18} aria-hidden="true" />
        </button>
        <button type="button" className="btn btn-on-green hide-mobile" onClick={copyRequestLink}>
          <Copy size={16} aria-hidden="true" /> <span className="btn-label">Salin link form</span>
        </button>
        <button type="button" className="btn btn-on-green hide-mobile" onClick={exportCsv}>
          <Download size={16} aria-hidden="true" /> <span className="btn-label">Export CSV</span>
        </button>
        <div ref={menuRef} style={{ position: "relative" }}>
          <button
            type="button"
            className="account-btn"
            aria-label={`Akun: ${auth.member.name}`}
            aria-expanded={menuOpen || sheetOpen}
            onClick={() => (window.matchMedia("(max-width: 720px)").matches ? setSheetOpen(true) : setMenuOpen(!menuOpen))}
          >
            <Avatar name={auth.member.name} color={auth.member.color} size={32} />
            <span className="name">{auth.member.name}</span>
            <ChevronDown size={14} className="chev" aria-hidden="true" />
          </button>
          {menuOpen && <AccountMenu auth={auth} onCopy={copyRequestLink} onExport={exportCsv} />}
        </div>
      </AppHeader>
      <main className="container page">
        <LocalModeBanner />
        <nav className="tabs hide-mobile" aria-label="Tampilan">
          <Link to="/tim" className={`tab ${onAnalytics ? "" : "active"}`} aria-current={onAnalytics ? undefined : "page"}>Kanban</Link>
          <Link to="/tim/analitik" className={`tab ${onAnalytics ? "active" : ""}`} aria-current={onAnalytics ? "page" : undefined}>Analitik</Link>
        </nav>
        <Outlet context={{ tasks, showToast, query, member: auth.member, members, designers, colorOf }} />
      </main>
      <nav className="bottom-nav" aria-label="Navigasi utama">
        <Link to="/tim" className={onAnalytics ? "" : "active"} aria-current={onAnalytics ? undefined : "page"}><LayoutDashboard size={22} aria-hidden="true" />Kanban</Link>
        <Link to="/tim/analitik" className={onAnalytics ? "active" : ""} aria-current={onAnalytics ? "page" : undefined}><BarChart3 size={22} aria-hidden="true" />Analitik</Link>
        <button type="button" onClick={() => setSheetOpen(true)}><UserRound size={22} aria-hidden="true" />Akun</button>
      </nav>
      {sheetOpen && <AccountMenu auth={auth} mobile onCopy={copyRequestLink} onExport={exportCsv} onClose={() => setSheetOpen(false)} />}
      {toast}
    </>
  );
}
