import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { supabase } from "../lib/supabase";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "sonner";

/* ================= ICONOS LEAFLET ================= */
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

/* ================= TIPOS ================= */

type GeoJSONPoint = {
  type: "Point";
  coordinates: [number, number]; // [lng, lat]
};

type PanicAlertViewRow = {
  id: string;
  created_at: string | null;
  status: string | null;
  target_department: string | null;
  accuracy_m: number | null;
  notes: string | null;
  ack_at: string | null;
  created_by: string | null;

  location_geojson: GeoJSONPoint | null;

  full_name: string | null;
  phone: string | null;
  photo_path: string | null;
};

/* ================= HELPERS ================= */

function formatDate(dt: string | null) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString();
}

function getLatLng(
  location: GeoJSONPoint | null | undefined
): { lat: number; lng: number } | null {
  if (
    !location ||
    location.type !== "Point" ||
    !Array.isArray(location.coordinates) ||
    location.coordinates.length !== 2
  ) {
    return null;
  }
  const [lng, lat] = location.coordinates;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return { lat, lng };
}

function openDirections(lat: number, lng: number) {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function openWhatsApp(phone: string) {
  // Si tu phone está en formato 09..., conviértelo a internacional si lo requieres.
  // Aquí lo dejo directo.
  const clean = phone.replace(/[^\d]/g, "");
  const url = `https://wa.me/${clean}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function FitToSelected({ alert }: { alert: PanicAlertViewRow | null }) {
  const map = useMap();

  useEffect(() => {
    const pos = getLatLng(alert?.location_geojson ?? null);
    if (!pos) return;
    map.setView([pos.lat, pos.lng], Math.max(map.getZoom(), 18), {
      animate: true,
    });
  }, [alert, map]);

  return null;
}

/* ================= COMPONENTE ================= */

export default function OperatorMap() {
  const [activeAlerts, setActiveAlerts] = useState<PanicAlertViewRow[]>([]);
  const [selected, setSelected] = useState<PanicAlertViewRow | null>(null);

  // Historial por cédula (si lo mantienes)
  const [cedula, setCedula] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<PanicAlertViewRow[]>([]);
  const [historyOwnerName, setHistoryOwnerName] = useState<string | null>(null);

  const channelRef = useRef<any>(null);

  const selectedPos = useMemo(() => {
    return getLatLng(selected?.location_geojson ?? null);
  }, [selected]);

  /* ===== CARGAR ACTIVAS ===== */
  const loadActive = async () => {
    const { data, error } = await supabase
      .from("panic_alerts_view")
      .select(
        "id, created_at, status, target_department, accuracy_m, notes, ack_at, created_by, location_geojson, full_name, phone, photo_path"
      )
      .eq("status", "ACTIVE")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      return;
    }

    const rows = (data ?? []) as PanicAlertViewRow[];
    setActiveAlerts(rows);

    // NO auto-seleccionar: el panel decide (como pediste)
    // Si quieres que al menos conserve selección anterior:
    if (selected) {
      const still = rows.find((r) => r.id === selected.id);
      setSelected(still ?? null);
    }
  };

  /* ===== REALTIME ===== */
  useEffect(() => {
    loadActive();

    channelRef.current = supabase
      .channel("realtime_panic_alerts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "panic_alerts" },
        () => loadActive()
      )
      .subscribe();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ===== HISTORIAL POR CÉDULA (opcional, igual que antes) ===== */
  const searchHistoryByCedula = async () => {
    const c = cedula.trim();
    if (!c) return toast.info("Ingresa una cédula.");

    setHistoryLoading(true);
    setHistory([]);
    setHistoryOwnerName(null);

    try {
      const { data: prof, error: e1 } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("cedula", c)
        .maybeSingle();

      if (e1) throw e1;
      if (!prof?.id) {
        toast.info("No se encontró un usuario con esa cédula.");
        return;
      }

      setHistoryOwnerName(prof.full_name ?? null);

      const { data: alerts, error: e2 } = await supabase
        .from("panic_alerts_view")
        .select(
          "id, created_at, status, target_department, accuracy_m, notes, ack_at, created_by, location_geojson, full_name, phone, photo_path"
        )
        .eq("created_by", prof.id)
        .order("created_at", { ascending: false })
        .limit(200);

      if (e2) throw e2;
      setHistory((alerts ?? []) as PanicAlertViewRow[]);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo consultar el historial");
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="h-full w-full flex">
      {/* ===== MAPA ===== */}
      <div className="flex-1 relative">
        <MapContainer
          center={[-2.1354, -79.5935]}
          zoom={17}
          className="h-full w-full"
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {/* centra cuando eliges desde el panel */}
          <FitToSelected alert={selected} />

          {/* MARCAR TODAS LAS ACTIVAS */}
          {activeAlerts.map((a) => {
            const pos = getLatLng(a.location_geojson);
            if (!pos) return null;

            const isSel = selected?.id === a.id;

            return (
              <Marker
                key={a.id}
                position={[pos.lat, pos.lng]}
                eventHandlers={{
                  click: () => setSelected(a),
                }}
              >
                <Popup>
                  <div className="space-y-1 text-sm">
                    <div className="font-semibold">
                      {a.full_name ?? "Usuario"} {isSel ? "(seleccionada)" : ""}
                    </div>
                    <div>Fecha: {formatDate(a.created_at)}</div>
                    <div>Dept: {a.target_department ?? "—"}</div>
                    <button
                      className="underline"
                      onClick={() => openDirections(pos.lat, pos.lng)}
                    >
                      Cómo llegar
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* ===== PANEL DERECHO ===== */}
      <aside className="w-[420px] max-w-[90vw] h-full border-l bg-white">
        <div className="h-full flex flex-col">
          <div className="px-4 py-3 border-b bg-slate-50">
            <div className="font-semibold text-slate-900">
              Operador · Alertas activas
            </div>
            <div className="text-xs text-slate-600">
              Activas: {activeAlerts.length}
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-6">
            {/* ===== LISTA DE ACTIVAS (SELECCIÓN AQUÍ) ===== */}
            <section className="space-y-3">
              <div className="font-semibold text-slate-900">
                Alertas activas
              </div>

              {activeAlerts.length === 0 ? (
                <div className="text-sm text-slate-500">
                  No hay alertas activas por el momento.
                </div>
              ) : (
                <div className="space-y-2">
                  {activeAlerts.map((a) => {
                    const isSel = selected?.id === a.id;
                    return (
                      <button
                        key={a.id}
                        onClick={() => setSelected(a)}
                        className={`w-full text-left rounded-lg border p-3 hover:bg-slate-50 ${
                          isSel ? "border-blue-600 bg-blue-50" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              a.photo_path ??
                              "https://ui-avatars.com/api/?name=Usuario"
                            }
                            className="w-10 h-10 rounded-full border object-cover"
                            alt="foto"
                          />

                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-slate-900 truncate">
                              {a.full_name ?? "Usuario"}
                            </div>
                            <div className="text-xs text-slate-600">
                              {formatDate(a.created_at)}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ===== DETALLE DE SELECCIÓN ===== */}
            <section className="space-y-3">
              <div className="font-semibold text-slate-900">
                Detalle de alerta
              </div>

              {!selected ? (
                <div className="text-sm text-slate-500">
                  Selecciona una alerta desde la lista.
                </div>
              ) : (
                <div className="rounded-lg border p-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={
                        selected.photo_path ??
                        "https://ui-avatars.com/api/?name=Usuario"
                      }
                      className="w-14 h-14 rounded-full border object-cover"
                      alt="foto"
                    />
                    <div>
                      <div className="font-semibold">
                        {selected.full_name ?? "Usuario"}
                      </div>
                      <div className="text-xs text-slate-600">
                        {formatDate(selected.created_at)}
                      </div>
                      <div className="text-xs text-slate-600">
                        {selected.target_department ?? "—"}
                      </div>
                    </div>
                  </div>

                  {selectedPos ? (
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        onClick={() => openDirections(selectedPos.lat, selectedPos.lng)}
                      >
                        Google Maps · Cómo llegar
                      </Button>
                    </div>
                  ) : (
                    <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                      Esta alerta no tiene ubicación en formato GeoJSON. Revisa que
                      la VIEW esté devolviendo <code>location_geojson</code>.
                    </div>
                  )}

                  {selected.phone ? (
                    <div className="grid grid-cols-2 gap-2">
                      <a href={`tel:${selected.phone}`}>
                        <Button variant="outline" className="w-full">
                          Llamar
                        </Button>
                      </a>

                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => openWhatsApp(selected.phone!)}
                      >
                        WhatsApp
                      </Button>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">
                      Sin teléfono registrado.
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ===== HISTORIAL POR CÉDULA (opcional) ===== */}
            <section className="space-y-3">
              <div className="font-semibold text-slate-900">
                Historial por cédula
              </div>

              <div className="flex gap-2">
                <Input
                  value={cedula}
                  onChange={(e) => setCedula(e.target.value)}
                  placeholder="Ej: 0923456789"
                />
                <Button
                  variant="outline"
                  onClick={searchHistoryByCedula}
                  disabled={historyLoading}
                >
                  {historyLoading ? "Buscando…" : "Buscar"}
                </Button>
              </div>

              {historyOwnerName && (
                <div className="text-sm text-slate-700">
                  Usuario: <span className="font-medium">{historyOwnerName}</span>
                </div>
              )}

              {history.length === 0 ? (
                <div className="text-sm text-slate-500">
                  {historyLoading ? "Cargando historial…" : "Sin resultados aún."}
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((h) => (
                    <div key={h.id} className="rounded-lg border p-3">
                      <div className="text-sm font-medium">
                        {formatDate(h.created_at)} · {h.status ?? "—"}
                      </div>
                      <div className="text-xs text-slate-600">
                        Dept: {h.target_department ?? "—"}
                      </div>
                      {h.notes && (
                        <div className="mt-2 text-xs whitespace-pre-wrap">
                          {h.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </aside>
    </div>
  );
}
