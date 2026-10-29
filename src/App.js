// Routing aplikasi. Struktur link: lihat CLAUDE.md ("Struktur link").

import React, { useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import StatusPage from "./pages/StatusPage";
import RequestPage from "./pages/RequestPage";
import EditRequestPage from "./pages/EditRequestPage";
import TeamLayout from "./pages/team/TeamLayout";
import BoardPage from "./pages/team/BoardPage";
import AnalyticsPage from "./pages/team/AnalyticsPage";

// Link lama berbasis hash ("/#/request") sudah tersebar; alihkan ke path baru.
function LegacyHashRedirect() {
  const { hash } = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (hash.startsWith("#/")) navigate(hash.slice(1), { replace: true });
  }, [hash, navigate]);
  return null;
}

export default function App() {
  return (
    <>
      <LegacyHashRedirect />
      <Routes>
        <Route path="/" element={<StatusPage />} />
        <Route path="/request" element={<RequestPage />} />
        <Route path="/request/:id/edit" element={<EditRequestPage />} />
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
