import { StrictMode } from "react";
import { initTheme } from "./lib/theme";

initTheme();
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, RequireApp, RequireAdmin, RequireAuth } from "./lib/auth";
import { AppLayout } from "./components/AppLayout";
import { LandingPage } from "./routes/LandingPage";
import { ApplyPage } from "./routes/ApplyPage";
import { DashboardPage } from "./routes/DashboardPage";
import { MyAnimePage } from "./routes/MyAnimePage";
import { AnimeDetailPage } from "./routes/AnimeDetailPage";
import { AddAnimePage } from "./routes/AddAnimePage";
import { AdminApplicationsPage } from "./routes/AdminApplicationsPage";
import { AdminPanelPage } from "./routes/AdminPanelPage";
import { SettingsPage } from "./routes/SettingsPage";
import { TermsPage } from "./routes/TermsPage";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route
            path="/apply"
            element={
              <RequireAuth>
                <ApplyPage />
              </RequireAuth>
            }
          />
          <Route
            path="/app"
            element={
              <RequireApp>
                <AppLayout />
              </RequireApp>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="my-anime" element={<MyAnimePage />} />
            <Route path="anime/new" element={<AddAnimePage />} />
            <Route path="anime/:id" element={<AnimeDetailPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route
              path="admin/applications"
              element={
                <RequireAdmin>
                  <AdminApplicationsPage />
                </RequireAdmin>
              }
            />
            <Route
              path="admin/panel"
              element={
                <RequireAdmin>
                  <AdminPanelPage />
                </RequireAdmin>
              }
            />
          </Route>
          <Route path="/terms" element={<TermsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
