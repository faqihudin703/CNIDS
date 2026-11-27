import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LoadingState } from "../components/ui/States";

export function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-base-900">
        <LoadingState label="Memeriksa sesi..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export function AdminRoute({ children }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export function SuperAdminRoute({ children }) {
  const { isSuperAdmin } = useAuth();
  if (!isSuperAdmin) {
    return <Navigate to="/" replace />;
  }
  return children;
}
