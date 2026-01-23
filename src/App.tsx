import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Home from "./pages/Home";
import AdminGeofence from "./pages/AdminGeofence";
import OperatorMap from "./pages/OperatorMap";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./layouts/AppLayout";
import RoleRedirect from "./pages/RoleRedirect";
import Verify from "./pages/Verify";
import ChangePassword from "./pages/ChangePassword";

export default function App() {
  return (
    <Routes>
      {/* LOGIN */}
      <Route path="/login" element={<Login />} />
      <Route path="/verify" element={<Verify />} />
      <Route
        path="/change-password"
        element={
          <ProtectedRoute>
            <ChangePassword />
          </ProtectedRoute>
        }
      />

      {/* DECISIÓN POR ROL */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <RoleRedirect />
          </ProtectedRoute>
        }
      />

      {/* APP CON LAYOUT */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/home" element={<Home />} />
        <Route path="/admin/geofence" element={<AdminGeofence />} />
        <Route path="/operator/map" element={<OperatorMap />} />
      </Route>
    </Routes>
  );
}
