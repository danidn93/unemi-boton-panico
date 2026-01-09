// src/pages/Home.tsx
import { useAuthProfile } from "../hooks/useAuthProfile";
import { Button } from "../components/ui/button";

export default function Home() {
  const { profile, loading } = useAuthProfile();

  // ⏳ Mientras carga el perfil
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p>Cargando información del usuario…</p>
      </div>
    );
  }

  // ⚠️ Perfil no existe (caso raro pero posible)
  if (!profile) {
    return (
      <div className="h-full flex items-center justify-center">
        <p>No se pudo cargar tu perfil.</p>
      </div>
    );
  }

  // ✅ Render normal
  return (
    <div className="h-full flex flex-col items-center justify-center gap-6">
      <h1 className="text-2xl font-semibold">
        Botón de Pánico UNEMI
      </h1>

      <p className="text-sm opacity-80">
        Usuario: {profile.full_name}
      </p>

      <Button
        className="bg-red-600 hover:bg-red-700 text-white px-10 py-6 text-lg"
      >
        ACTIVAR PÁNICO
      </Button>
    </div>
  );
}
