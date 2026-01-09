import { useState } from "react";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";

export default function AlertPanel({
  alert,
  onClose,
}: {
  alert: any;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const closeAlert = async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("panic_alerts")
      .update({
        status: "CLOSED",
        closed_by: user?.id,
        closed_at: new Date().toISOString(),
        notes,
      })
      .eq("id", alert.id);

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Alerta cerrada correctamente");
    onClose();
  };

  return (
    <aside className="w-96 bg-white border-l p-4 overflow-y-auto">
      <h2 className="font-semibold text-lg mb-2">Gestión de alerta</h2>

      <p className="text-sm mb-1">
        <strong>Cédula:</strong> {alert.device_info?.cedula}
      </p>

      <p className="text-sm mb-4">
        <strong>Departamento:</strong> {alert.target_department}
      </p>

      <textarea
        className="w-full border rounded p-2 text-sm"
        rows={4}
        placeholder="Comentarios del operador"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <div className="flex justify-between mt-4">
        <button
          onClick={onClose}
          className="px-3 py-1 border rounded"
        >
          Cancelar
        </button>

        <button
          onClick={closeAlert}
          disabled={loading}
          className="px-3 py-1 bg-red-600 text-white rounded"
        >
          {loading ? "Cerrando..." : "Cerrar alerta"}
        </button>
      </div>
    </aside>
  );
}
