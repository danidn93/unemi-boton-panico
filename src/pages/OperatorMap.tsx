// src/pages/OperatorMap.tsx
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { supabase } from "../lib/supabase";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "sonner";

// (Opcional) si ves iconos raros en Leaflet en Vite, normalmente hay que setear icon urls.
// Si ya lo resolviste, puedes borrar este bloque.
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type GeoJSONPoint = { type: "Point"; coordinates: [number, number] };

type PanicAlertRow = {
  id: string;
  created_at: string | null;
  created_by: string | null;
  status: string | null;
  target_department: string;
  location: GeoJSONPoint;
  accuracy_m: number | null;
  device_info: any | null;
  notes: string | null;
  ack_by: string | null;
  ack_at: string | null;
  closed_by: string | null;
  closed_at: string | null;
};

function FitToSelected({ alert }: { alert: PanicAlertRow | null }) {
  const map = useMap();

  useEffect(() => {
    if (!alert?.location?.coordinates) return;
    const [lng, lat] = alert.location.coordinates;
    map.setView([lat, lng], Math.max(map.getZoom(), 18), { animate: true });
  }, [alert, map]);

  return null;
}

function formatDate(dt: string | null) {
  if (!dt) return "—";
  const d = new Date(dt);
  return d.toLocaleString();
}

function openDirections(lat: number, lng: number) {
  // Google Maps: directions to destination
  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export default function OperatorMap() {
  const [activeAlerts, setActiveAlerts] = useState<PanicAlertRow[]>([]);
  const [selected, setSelected] = useState<PanicAlertRow | null>(null);

  // Historial por cédula
  const [cedula, setCedula] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<PanicAlertRow[]>([]);
  const [historyOwnerName, setHistoryOwnerName] = useState<string | null>(null);

  // Comentarios / cierre
  const [closing, setClosing] = useState(false);
  const [comment, setComment] = useState("");

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const selectedLatLng = useMemo(() => {
    if (!selected?.location?.coordinates) return null;
    const [lng, lat] = selected.location.coordinates;
    return { lat, lng };
  }, [selected]);

  const loadActive = async () => {
    const { data, error } = await supabase
      .from("panic_alerts")
      .select("*")
      .eq("status", "ACTIVE")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      return;
    }

    const rows = (data || []) as PanicAlertRow[];
    setActiveAlerts(rows);

    // Si no hay seleccionado, selecciona el más reciente
    if (!selected && rows.length) setSelected(rows[0]);
    // Si el seleccionado ya no está activo, actualiza
    if (selected && rows.length) {
      const still = rows.find((r) => r.id === selected.id);
      if (!still) setSelected(rows[0]);
      else setSelected(still);
    }
  };

  // Realtime: escuchar cambios en panic_alerts y refrescar activos
  useEffect(() => {
    loadActive();

    channelRef.current = supabase
      .channel("realtime_panic_alerts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "panic_alerts" },
        () => {
          // Refresca lista activa en cualquier cambio (insert/update/close)
          loadActive();
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ackAlert = async (row: PanicAlertRow) => {
    const { data: u } = await supabase.auth.getUser();
    const myId = u.user?.id;
    if (!myId) return toast.error("No se pudo identificar tu sesión.");

    const { error } = await supabase
      .from("panic_alerts")
      .update({
        ack_by: myId,
        ack_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (error) return toast.error(error.message);
    toast.success("Alerta confirmada (ack).");
    await loadActive();
  };

  const closeAlert = async () => {
    if (!selected) return;
    const { data: u } = await supabase.auth.getUser();
    const myId = u.user?.id;
    if (!myId) return toast.error("No se pudo identificar tu sesión.");

    setClosing(true);
    try {
      const newNote = comment.trim();

      // Si ya había notes, concatena manteniendo historial
      const mergedNotes =
        newNote.length === 0
          ? selected.notes
          : (selected.notes ? `${selected.notes}\n\n` : "") +
            `[${new Date().toLocaleString()}] ${newNote}`;

      const { error } = await supabase
        .from("panic_alerts")
        .update({
          status: "CLOSED",
          closed_by: myId,
          closed_at: new Date().toISOString(),
          notes: mergedNotes ?? null,
        })
        .eq("id", selected.id);

      if (error) throw error;

      toast.success("Caso cerrado.");
      setComment("");
      setSelected(null);
      await loadActive();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo cerrar el caso");
    } finally {
      setClosing(false);
    }
  };

  const searchHistoryByCedula = async () => {
    const c = cedula.trim();
    if (!c) return toast.info("Ingresa una cédula.");

    setHistoryLoading(true);
    setHistory([]);
    setHistoryOwnerName(null);

    try {
      // 1) Buscar profile por cédula
      const { data: prof, error: e1 } = await supabase
        .from("profiles")
        .select("id, full_name, cedula")
        .eq("cedula", c)
        .maybeSingle();

      if (e1) throw e1;
      if (!prof?.id) {
        toast.info("No se encontró un usuario con esa cédula.");
        return;
      }

      setHistoryOwnerName(prof.full_name ?? null);

      // 2) Buscar alertas por created_by (historial completo)
      const { data: alerts, error: e2 } = await supabase
        .from("panic_alerts")
        .select("*")
        .eq("created_by", prof.id)
        .order("created_at", { ascending: false })
        .limit(200);

      if (e2) throw e2;

      setHistory((alerts || []) as PanicAlertRow[]);
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

          <FitToSelected alert={selected} />

          {/* Solo ACTIVE */}
          {activeAlerts.map((a) => {
            const [lng, lat] = a.location.coordinates;
            const isSel = selected?.id === a.id;

            return (
              <Marker
                key={a.id}
                position={[lat, lng]}
                eventHandlers={{
                  click: () => setSelected(a),
                }}
              >
                <Popup>
                  <div className="space-y-2">
                    <div className="font-semibold">
                      ALERTA {isSel ? "(seleccionada)" : ""}
                    </div>
                    <div className="text-sm">
                      Creada: {formatDate(a.created_at)}
                    </div>
                    <div className="text-sm">
                      Precisión: {a.accuracy_m ?? "—"} m
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="text-sm underline"
                        onClick={() => openDirections(lat, lng)}
                      >
                        Cómo llegar
                      </button>
                      <button
                        className="text-sm underline"
                        onClick={() => setSelected(a)}
                      >
                        Ver panel
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* ===== PANEL DERECHO (Alert + Historial) ===== */}
      <aside className="w-[420px] max-w-[90vw] h-full border-l bg-white">
        <div className="h-full flex flex-col">
          {/* Tabs simples */}
          <div className="px-4 py-3 border-b bg-slate-50">
            <div className="font-semibold text-slate-900">
              Operador · Gestión de alertas
            </div>
            <div className="text-xs text-slate-600">
              Activas: {activeAlerts.length}
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-6">
            {/* ===== ALERT PANEL ===== */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-slate-900">Alerta activa</div>
                {selected ? (
                  <span className="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {selected.status ?? "ACTIVE"}
                  </span>
                ) : (
                  <span className="text-xs text-slate-500">Sin selección</span>
                )}
              </div>

              {!selected ? (
                <div className="text-sm text-slate-600">
                  Haz clic en un marcador para ver detalles.
                </div>
              ) : (
                <div className="space-y-3 rounded-lg border p-3">
                  <div className="text-sm">
                    <div className="text-xs text-slate-500">ID</div>
                    <div className="font-mono text-xs break-all">
                      {selected.id}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-slate-500">Creada</div>
                      <div>{formatDate(selected.created_at)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Precisión</div>
                      <div>{selected.accuracy_m ?? "—"} m</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Departamento</div>
                      <div>{selected.target_department}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Ack</div>
                      <div>{selected.ack_at ? "Sí" : "No"}</div>
                    </div>
                  </div>

                  {selectedLatLng && (
                    <div className="text-sm">
                      <div className="text-xs text-slate-500">Ubicación</div>
                      <div className="font-mono text-xs">
                        {selectedLatLng.lat.toFixed(6)},{" "}
                        {selectedLatLng.lng.toFixed(6)}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() =>
                            openDirections(selectedLatLng.lat, selectedLatLng.lng)
                          }
                        >
                          Cómo llegar
                        </Button>

                        <Button
                          variant="outline"
                          onClick={() => ackAlert(selected)}
                          disabled={!!selected.ack_at}
                        >
                          {selected.ack_at ? "Ack enviado" : "Confirmar (Ack)"}
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="text-xs font-medium text-slate-700">
                      Comentario / Observación (notes)
                    </div>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={4}
                      className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                      placeholder="Escribe el comentario para registrar en notes al cerrar el caso…"
                    />

                    <Button
                      variant="destructive"
                      onClick={closeAlert}
                      disabled={closing}
                    >
                      {closing ? "Cerrando…" : "Cerrar caso"}
                    </Button>

                    {selected.notes && (
                      <div className="pt-2 border-t">
                        <div className="text-xs font-medium text-slate-700">
                          Notes actuales
                        </div>
                        <pre className="mt-1 whitespace-pre-wrap text-xs text-slate-700 bg-slate-50 border rounded-md p-2">
                          {selected.notes}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* ===== HISTORY PANEL ===== */}
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
                  {historyLoading
                    ? "Cargando historial…"
                    : "Sin resultados aún."}
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((h) => {
                    const [lng, lat] = h.location.coordinates;
                    return (
                      <div
                        key={h.id}
                        className="rounded-lg border p-3 hover:bg-slate-50"
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium text-slate-900">
                            {h.status ?? "—"}
                          </div>
                          <div className="text-xs text-slate-500">
                            {formatDate(h.created_at)}
                          </div>
                        </div>

                        <div className="text-xs text-slate-600 mt-1">
                          Dept: {h.target_department} · Precisión:{" "}
                          {h.accuracy_m ?? "—"}m
                        </div>

                        <div className="mt-2 flex gap-2">
                          <button
                            className="text-xs underline"
                            onClick={() => {
                              // si está ACTIVE lo seleccionas desde la lista activa,
                              // si no está activo igual puedes centrar con setSelected temporalmente
                              setSelected(h);
                            }}
                          >
                            Ver en mapa
                          </button>

                          <button
                            className="text-xs underline"
                            onClick={() => openDirections(lat, lng)}
                          >
                            Cómo llegar
                          </button>
                        </div>

                        {h.notes && (
                          <div className="mt-2 text-xs text-slate-700 whitespace-pre-wrap">
                            {h.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </aside>
    </div>
  );
}
