// Routing aplikasi. Struktur link: lihat CLAUDE.md ("Struktur link").

import React, { useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import RequestPage from "./pages/RequestPage";
import TeamLayout from "./pages/team/TeamLayout";
import BoardPage from "./pages/team/BoardPage";
import AnalyticsPage from "./pages/team/AnalyticsPage";

// Link lama berbasis hash ("/#/request") sudah tersebar; alihkan ke path baru.
function LegacyHashRedirect() {
  const { hash } = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    // "#access_token=…" milik login Google (Supabase), bukan link lama.
    if (hash.startsWith("#/")) navigate(hash.slice(1), { replace: true });
  }, [hash, navigate]);
  return null;
}

export default function App() {
  return (
    <>
      <LegacyHashRedirect />
      <Routes>
        <Route path="/" element={<RequestPage />} />
        <Route path="/request" element={<Navigate to="/" replace />} />
        <Route path="/tim" element={<TeamLayout />}>
          <Route index element={<BoardPage />} />
          <Route path="task/:id" element={<BoardPage />} />
          <Route path="analitik" element={<AnalyticsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
