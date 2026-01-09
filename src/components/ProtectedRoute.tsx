import { Navigate } from 'react-router-dom';
import { useAuthProfile } from '../hooks/useAuthProfile';

export default function ProtectedRoute({ children }: any) {
  const { profile, loading } = useAuthProfile();

  if (loading) return <p>Cargando...</p>;
  if (!profile) return <Navigate to="/login" />;

  return children;
}
