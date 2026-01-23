import { MapContainer, TileLayer, Polygon, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./../components/ui/dialog";
/* ===================== TIPOS ===================== */

type GeoJSONPolygon = {
  type: "Polygon";
  coordinates: number[][][];
};

type CampusGeofence = {
  id: string;
  code: string;
  city: string | null;
  active: boolean;
  polygon: GeoJSONPolygon;
};

type Sede = {
  id: string;
  nombre: string;
  ciudad: string;
  direccion: string;
  campus_geofences_view: CampusGeofence[];
};

/* ===================== MAP HELPERS ===================== */

function FitBounds({ latlngs }: { latlngs: L.LatLng[] }) {
  const map = useMap();

  useEffect(() => {
    if (!latlngs.length) return;
    map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40] });
  }, [latlngs, map]);

  return null;
}

function GeomanEditor({
  sede,
  onSaved,
}: {
  sede: Sede | null;
  onSaved: () => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!sede) return;

    // @ts-ignore
    map.pm.addControls({
      position: "topright",
      drawPolygon: true,
      drawMarker: false,
      drawPolyline: false,
      drawCircle: false,
      drawRectangle: false,
      drawCircleMarker: false,
      editMode: false,
      dragMode: false,
      cutPolygon: false,
      removalMode: true,
    });

    const onCreate = async (e: any) => {
      const layer = e.layer as L.Polygon;
      const latlngs = layer.getLatLngs()[0] as L.LatLng[];

      const coords = latlngs.map((p) => `${p.lng} ${p.lat}`);
      coords.push(coords[0]);

      const wkt = `POLYGON((${coords.join(",")}))`;

      const { error } = await supabase.rpc("create_sede_with_geofence", {
        p_sede_id: sede.id,
        p_polygon: wkt,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Geocerca guardada correctamente");
        onSaved();
      }
    };

    // @ts-ignore
    map.on("pm:create", onCreate);

    return () => {
      // limpieza correcta
      // @ts-ignore
      map.off("pm:create", onCreate);
      // @ts-ignore
      map.pm.removeControls();
    };
  }, [map, sede, onSaved]);

  return null;
}

/* ===================== COMPONENTE PRINCIPAL ===================== */

export default function AdminGeofence() {
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [selected, setSelected] = useState<Sede | null>(null);

  const [newNombre, setNewNombre] = useState("");
  const [newCiudad, setNewCiudad] = useState("");
  const [newDireccion, setNewDireccion] = useState("");

  /* ===== NUEVO STAFF ===== */
  const [staffModalOpen, setStaffModalOpen] = useState(false);

  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffCedula, setStaffCedula] = useState("");
  const [staffPhone, setStaffPhone] = useState("");
  const [staffAddress, setStaffAddress] = useState("");
  const [staffRole, setStaffRole] = useState<"STAFF" | "OPERATOR">("STAFF");
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [staffDepartment, setStaffDepartment] = useState<
    "BIENESTAR" | "SALUD_OCUPACIONAL" | ""
  >("");

  /* ===== CARGAR SEDES ===== */
  const loadSedes = async () => {
    const { data, error } = await supabase
      .from("sedes")
      .select(`
        id,
        nombre,
        ciudad,
        direccion,
        campus_geofences_view (
          id,
          code,
          city,
          active,
          polygon
        )
      `)
      .eq("active", true);

    if (error) {
      toast.error(error.message);
      return;
    }

    const rows = (data ?? []) as Sede[];
    setSedes(rows);

    // seleccionar Milagro por defecto si existe
    const milagro = rows.find(
      (s) => s.campus_geofences_view?.[0]?.code === "MIL"
    );
    setSelected(milagro ?? rows[0] ?? null);
  };

  useEffect(() => {
    loadSedes();
  }, []);

  /* ===== POLÍGONO ACTUAL ===== */
  const polygonLatLngs = useMemo(() => {
    const geo = selected?.campus_geofences_view?.[0];
    if (!geo || geo.polygon.type !== "Polygon") return [];

    return geo.polygon.coordinates[0].map(
      ([lng, lat]) => L.latLng(lat, lng)
    );
  }, [selected]);

  /* ===== CREAR SEDE ===== */
  const createSede = async () => {
    if (!newNombre || !newCiudad || !newDireccion) {
      toast.error("Completa todos los campos");
      return;
    }

    const { error } = await supabase.from("sedes").insert({
      nombre: newNombre,
      ciudad: newCiudad,
      direccion: newDireccion,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Sede creada. Dibuja la geocerca.");
    setNewNombre("");
    setNewCiudad("");
    setNewDireccion("");
    loadSedes();
  };

const createStaff = async () => {
  if (!staffName || !staffEmail || !staffCedula) {
    toast.error("Completa los campos obligatorios");
    return;
  }

  if (!staffEmail.toLowerCase().endsWith("@unemi.edu.ec")) {
    toast.error("Debe usar correo institucional @unemi.edu.ec");
    return;
  }

  if (staffRole === "OPERATOR" && !staffDepartment) {
    toast.error("Seleccione el departamento del gestor");
    return;
  }

  try {
    setCreatingStaff(true);

    const { data, error } = await supabase.functions.invoke(
      "create-staff-and-send-email",
      {
        body: {
          full_name: staffName.trim(),
          institutional_email: staffEmail.trim().toLowerCase(),
          cedula: staffCedula.trim(),

          // ✅ AQUÍ ESTABA EL ERROR
          phone: staffPhone?.trim() || "",
          address: staffAddress?.trim() || "",

          role: staffRole,
          department:
            staffRole === "OPERATOR" ? staffDepartment : null,

          sede_id: selected?.id ?? null,
          campus_id: null,
        },
      }
    );

    if (error) throw error;
    if (!data?.ok) throw new Error(data?.error ?? "Error desconocido");

    toast.success("Usuario creado y correo enviado");

    setStaffName("");
    setStaffEmail("");
    setStaffCedula("");
    setStaffPhone("");
    setStaffAddress("");
    setStaffRole("STAFF");
    setStaffDepartment("");
    setStaffModalOpen(false);
  } catch (err: any) {
    toast.error(err.message ?? "No se pudo crear el usuario");
  } finally {
    setCreatingStaff(false);
  }
};

  return (
    <div className="h-full w-full flex">
      {/* ===== PANEL LATERAL ===== */}
      <aside className="w-[380px] border-r bg-white p-4 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-3">Gestión de sedes</h2>

        {/* ===== LISTA DE SEDES ===== */}
        <div className="space-y-3 mb-6">
          {sedes.map((s) => (
            <div
              key={s.id}
              onClick={() => setSelected(s)}
              className={`border rounded p-3 cursor-pointer ${
                selected?.id === s.id
                  ? "border-blue-600 bg-blue-50"
                  : "hover:bg-slate-50"
              }`}
            >
              <div className="font-medium">{s.nombre}</div>
              <div className="text-xs text-slate-600">
                {s.ciudad} · {s.direccion}
              </div>
              <div className="text-xs mt-1">
                Geocerca: {s.campus_geofences_view.length ? "Sí" : "No"}
              </div>
            </div>
          ))}
        </div>

        {/* ===== NUEVA SEDE ===== */}
        <div className="border-t pt-4">
          <h3 className="font-semibold text-sm mb-2">Nueva sede</h3>

          <div className="space-y-2">
            <Input
              placeholder="Nombre"
              value={newNombre}
              onChange={(e) => setNewNombre(e.target.value)}
            />
            <Input
              placeholder="Ciudad"
              value={newCiudad}
              onChange={(e) => setNewCiudad(e.target.value)}
            />
            <Input
              placeholder="Dirección"
              value={newDireccion}
              onChange={(e) => setNewDireccion(e.target.value)}
            />

            <Button onClick={createSede} className="w-full">
              Crear sede
            </Button>
          </div>
        </div>

        {/* ===== ACCIÓN STAFF (NO FORMULARIO) ===== */}
        <div className="border-t pt-4 mt-6">
          <h3 className="font-semibold text-sm mb-2">
            Usuarios Administrativos
          </h3>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => setStaffModalOpen(true)}
          >
            ➕ Registrar usuario
          </Button>
        </div>
      </aside>
      {/* ===== MAPA ===== */}
      <div className="flex-1">
        <MapContainer
          center={[-2.1354, -79.5935]}
          zoom={16}
          className="h-full w-full"
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {polygonLatLngs.length > 2 && (
            <>
              <Polygon
                positions={polygonLatLngs}
                pathOptions={{ color: "#2563eb" }}
              />
              <FitBounds latlngs={polygonLatLngs} />
            </>
          )}

          <GeomanEditor sede={selected} onSaved={loadSedes} />
        </MapContainer>
      </div>

      {/* ===== MODAL REGISTRO STAFF ===== */}
      <Dialog open={staffModalOpen} onOpenChange={setStaffModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar usuario institucional</DialogTitle>
            <DialogDescription>
              Crea un nuevo usuario Administrativo o Gestor. La contraseña inicial será la cédula
              y deberá cambiarla al iniciar sesión.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              placeholder="Nombre completo"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
            />

            <Input
              placeholder="Correo institucional (@unemi.edu.ec)"
              value={staffEmail}
              onChange={(e) => setStaffEmail(e.target.value)}
            />

            <Input
              placeholder="Cédula (contraseña inicial)"
              value={staffCedula}
              onChange={(e) => setStaffCedula(e.target.value)}
            />

            <Input
              placeholder="Teléfono (opcional)"
              value={staffPhone}
              onChange={(e) => setStaffPhone(e.target.value)}
            />

            <Input
              placeholder="Dirección (opcional)"
              value={staffAddress}
              onChange={(e) => setStaffAddress(e.target.value)}
            />

            {/* ===== ROL ===== */}
            <select
              className="w-full border rounded px-3 py-2 text-sm"
              value={staffRole}
              onChange={(e) =>
                setStaffRole(e.target.value as "STAFF" | "OPERATOR")
              }
            >
              <option value="STAFF">Administrativo</option>
              <option value="OPERATOR">Gestor</option>
            </select>

            {/* ===== DEPARTAMENTO (SOLO OPERATOR) ===== */}
            {staffRole === "OPERATOR" && (
              <select
                className="w-full border rounded px-3 py-2 text-sm"
                value={staffDepartment}
                onChange={(e) =>
                  setStaffDepartment(
                    e.target.value as "BIENESTAR" | "SALUD_OCUPACIONAL"
                  )
                }
              >
                <option value="">Seleccione departamento</option>
                <option value="BIENESTAR">Bienestar</option>
                <option value="SALUD_OCUPACIONAL">Salud Ocupacional</option>
              </select>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setStaffModalOpen(false)}
              disabled={creatingStaff}
            >
              Cancelar
            </Button>

            <Button
              onClick={async () => {
                await createStaff();
                setStaffModalOpen(false);
              }}
              disabled={creatingStaff}
            >
              {staffRole === "OPERATOR"
                ? "Crear Gestor"
                : "Crear Administrativo"}

            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
