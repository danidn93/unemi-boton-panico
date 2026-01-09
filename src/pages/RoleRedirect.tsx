import { Navigate } from "react-router-dom";
import { useAuthProfile } from "../hooks/useAuthProfile";

export default function RoleRedirect() {
  const { profile, loading } = useAuthProfile();

  if (loading) return <p>Cargando...</p>;
  if (!profile) return <Navigate to="/login" replace />;

  switch (profile.role) {
    case "ADMIN":
      return <Navigate to="/admin/geofence" replace />;
    case "OPERATOR":
      return <Navigate to="/operator/map" replace />;
    case "STUDENT":
    case "STAFF":
      return <Navigate to="/home" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
}
