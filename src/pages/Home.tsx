// src/pages/Home.tsx
import { useState } from "react";
import { useAuthProfile } from "../hooks/useAuthProfile";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { supabase } from "../lib/supabase";

function getTargetDepartment(role: string | null | undefined) {
  switch (role) {
    case "STUDENT":
      return "BIENESTAR";
    case "STAFF":
      return "SALUD_OCUPACIONAL";
    default:
      return "SEGURIDAD";
  }
}

export default function Home() {
  const { profile, loading } = useAuthProfile();
  const [sending, setSending] = useState(false);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p>Cargando información del usuario…</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="h-full flex items-center justify-center">
        <p>No se pudo cargar tu perfil.</p>
      </div>
    );
  }

  const activatePanic = () => {
    if (!navigator.geolocation) {
      toast.error("Este dispositivo no soporta GPS");
      return;
    }

    setSending(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;

        try {
          const { data, error } = await supabase.rpc(
            "create_panic_alert_with_location",
            {
              p_user_id: profile.id,
              p_lat: latitude,
              p_lng: longitude,
              p_accuracy: accuracy,
              p_target_department: getTargetDepartment(profile.role),
            }
          );

          if (error) throw error;

          if (!data?.ok) {
            toast.error(
              "⚠️ Estás fuera del campus. No se puede enviar la alerta."
            );
            return;
          }

          toast.success("🚨 Alerta enviada correctamente");
        } catch (e: any) {
          toast.error(
            e?.message ?? "No se pudo procesar la alerta"
          );
        } finally {
          setSending(false);
        }
      },
      (err) => {
        setSending(false);

        switch (err.code) {
          case err.PERMISSION_DENIED:
            toast.error("Permiso de ubicación denegado");
            break;
          case err.POSITION_UNAVAILABLE:
            toast.error("No se pudo obtener la ubicación");
            break;
          case err.TIMEOUT:
            toast.error("Tiempo de espera agotado");
            break;
          default:
            toast.error("Error al obtener ubicación");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  return (
    <div className="h-full flex flex-col items-center justify-center gap-6">
      <h1 className="text-2xl font-semibold">
        Botón de Pánico UNEMI
      </h1>

      <p className="text-sm opacity-80">
        Usuario: {profile.full_name}
      </p>

      <Button
        onClick={activatePanic}
        disabled={sending}
        className="bg-red-600 hover:bg-red-700 text-white px-10 py-6 text-lg"
      >
        {sending ? "ENVIANDO…" : "ACTIVAR PÁNICO"}
      </Button>
    </div>
  );
}
