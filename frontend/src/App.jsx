import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute, AdminRoute, SuperAdminRoute } from "./routes/guards";
import AppShell from "./components/layout/AppShell";

import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import DevicesPage from "./pages/DevicesPage";
import DeviceDetailPage from "./pages/DeviceDetailPage";
import BuildingsPage from "./pages/BuildingsPage";
import IpamPage from "./pages/IpamPage";
import WarningsPage from "./pages/WarningsPage";
import ActivityLogsPage from "./pages/ActivityLogsPage";
import UsersPage from "./pages/UsersPage";
import NotFoundPage from "./pages/NotFoundPage";

function Shell({ title, description, action, children }) {
  return (
    <ProtectedRoute>
      <AppShell title={title} description={description} action={action}>
        {children}
      </AppShell>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/devices"
            element={
              <ProtectedRoute>
                <DevicesPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/devices/:id"
            element={
              <ProtectedRoute>
                <DeviceDetailPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/buildings"
            element={
              <ProtectedRoute>
                <BuildingsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/warnings"
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <WarningsPage />
                </AdminRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/ipam"
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <IpamPage />
                </AdminRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/activity-logs"
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <ActivityLogsPage />
                </AdminRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <SuperAdminRoute>
                  <UsersPage />
                </SuperAdminRoute>
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
