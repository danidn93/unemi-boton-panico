import { Navigate, useLocation } from "react-router-dom";
import { useAuthProfile } from "../hooks/useAuthProfile";
import React from "react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { profile, loading } = useAuthProfile();
  const location = useLocation();

  if (loading) {
    return <p>Cargando...</p>;
  }

  // ❌ No autenticado
  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  // 🔴 Forzar cambio de contraseña
  if (
    profile.force_password_change === true &&
    location.pathname !== "/change-password"
  ) {
    return <Navigate to="/change-password" replace />;
  }

  return <>{children}</>;
}
