import { useEffect, useMemo, useRef, useState } from "react";
import { useAuthProfile } from "../hooks/useAuthProfile";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
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

const EQUIPMENT = [
  { id: "BOTIQUIN", label: "Botiquín" },
  { id: "CAMILLA", label: "Camilla" },
  { id: "SILLA_RUEDAS", label: "Silla de ruedas" },
];

type UiState = "IDLE" | "SENDING" | "SENT" | "ATTENDING";

export default function Home() {
  const { profile, loading } = useAuthProfile();

  const [ui, setUi] = useState<UiState>("IDLE");
  const [openModal, setOpenModal] = useState(false);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [alertId, setAlertId] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);

  const falseAlerts = useMemo(() => profile?.false_alert ?? 0, [profile]);

  useEffect(() => {
    if (!profile) return;

    const fetchLastAlert = async () => {
      const { data, error } = await supabase
        .from("panic_alerts")
        .select("id, status")
        .eq("created_by", profile.id)
        .in("status", ["ACTIVE", "ATENDIENDO"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return;

      setAlertId(data.id);

      if (data.status === "ATENDIENDO") {
        setUi("ATTENDING");
      } else {
        setUi("SENT");
      }
    };

    fetchLastAlert();
  }, [profile]);

  useEffect(() => {
    if (!alertId) return;

    const checkCurrentStatus = async () => {
      const { data, error } = await supabase
        .from("panic_alerts")
        .select("status")
        .eq("id", alertId)
        .single();

      if (error) return;

      if (data.status === "ATENDIENDO") {
        setUi("ATTENDING");
      }
    };

    checkCurrentStatus();
  }, [alertId]);

  /* ===============================
     REALTIME – AYUDA EN CAMINO
  ================================ */
  useEffect(() => {
    if (!alertId) return;

    const channel = supabase
      .channel("panic-attending")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "panic_alerts",
          filter: `id=eq.${alertId}`,
        },
        (payload: any) => {
          if (payload.new.status === "ATENDIENDO") {
            setUi("ATTENDING");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [alertId]);

  if (loading || !profile) return null;

  /* ===============================
     SUBIR FOTO (CÁMARA)
  ================================ */
  const uploadPhoto = async (): Promise<string | null> => {
    if (!photo) return null;

    const path = `panic/${profile.id}/${Date.now()}.jpg`;

    const { error } = await supabase.storage
      .from("panic-photos")
      .upload(path, photo, { contentType: "image/jpeg" });

    if (error) {
      toast.error("No se pudo adjuntar la foto");
      return null;
    }

    return path;
  };

  /* ===============================
     ENVIAR ALERTA
  ================================ */
  const sendAlert = async () => {
    setOpenModal(false);
    setUi("SENDING");

    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const photoPath = await uploadPhoto();

        const { data, error } = await supabase.rpc(
          "create_panic_alert_with_location",
          {
            p_created_by: profile.id,
            p_lat: pos.coords.latitude,
            p_lng: pos.coords.longitude,
            p_accuracy_m: pos.coords.accuracy,
            p_target_department: getTargetDepartment(profile.role),
            p_equipment: equipment,          // string[]
            p_photo_path: photoPath,          // string | null
            p_device_info: { ua: navigator.userAgent },
            p_notes: null,
          }
        );

        if (error || !data?.ok) {
          throw error;
        }

        setAlertId(data.alert_id);
        setUi("SENT");
      } catch {
        toast.error("No se pudo enviar la alerta");
        setUi("IDLE");
      }
    });
  };

  const bgClass =
    ui === "ATTENDING"
      ? "bg-green-600"
      : "bg-red-600";

  return (
    <div
      className={`h-full ${bgClass} text-white flex flex-col px-6 transition-colors duration-500`}
    >
      {/* Alertas falsas (ARRIBA) */}
      <div className="w-full flex justify-center pt-safe mt-1">
        <p className="text-sm font-semibold text-white">
          Alertas falsas registradas: {falseAlerts}
        </p>
      </div>

      {/* CONTENEDOR CENTRAL (centra el botón) */}
      <div className="flex-1 flex items-center justify-center">

        {/* Mensaje final */}
        {ui === "ATTENDING" ? (
          <div className="text-center space-y-2">
            <p className="text-xl font-semibold">
              🚑 La ayuda va en camino
            </p>
            <p className="text-sm">
              Llegaremos a ti lo más pronto posible
            </p>
          </div>
        ) : (
          <button
            onClick={() => setOpenModal(true)}
            disabled={ui !== "IDLE"}
            className="w-56 h-56 rounded-full bg-white text-red-600 text-5xl font-extrabold shadow-2xl active:scale-95 transition"
          >
            {ui === "SENDING" ? "…" : "SOS"}
          </button>
        )}

      </div>

      {/* Modal */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-black">
              Antes de enviar
            </DialogTitle>
          </DialogHeader>

          {/* Equipos */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-black">
              Equipos necesarios
            </p>
            {EQUIPMENT.map((e) => (
              <label
                key={e.id}
                className="flex items-center gap-2 text-sm text-black"
              >
                <input
                  type="checkbox"
                  checked={equipment.includes(e.id)}
                  onChange={(ev) =>
                    setEquipment((prev) =>
                      ev.target.checked
                        ? [...prev, e.id]
                        : prev.filter((i) => i !== e.id)
                    )
                  }
                />
                {e.label}
              </label>
            ))}
          </div>

          {/* Cámara */}
          <div className="pt-3">
            <p className="text-sm font-semibold mb-1 text-black">
              Foto (opcional)
            </p>
            <Button
              variant="outline"
              onClick={() => cameraInputRef.current?.click()}
            >
              📷 Abrir cámara
            </Button>
            {photo && (
              <p className="text-xs mt-1 text-green-600">
                Foto capturada
              </p>
            )}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setPhoto(file);
              }}
            />
          </div>

          {/* Acciones */}
          <div className="pt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpenModal(false)}>
              Cancelar
            </Button>
            <Button onClick={sendAlert}>
              Enviar alerta
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
