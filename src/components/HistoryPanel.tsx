import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function HistoryPanel({
  cedula,
  onClose,
}: {
  cedula: string;
  onClose: () => void;
}) {
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from("panic_alerts")
      .select("*")
      .contains("device_info", { cedula })
      .order("created_at", { ascending: false })
      .then(({ data }) => setHistory(data || []));
  }, [cedula]);

  return (
    <aside className="w-96 bg-gray-50 border-l p-4 overflow-y-auto">
      <h2 className="font-semibold text-lg mb-3">
        Historial · {cedula}
      </h2>

      {history.map((h) => (
        <div
          key={h.id}
          className="border rounded p-2 mb-2 text-sm"
        >
          <p>
            <strong>Estado:</strong> {h.status}
          </p>
          <p>
            <strong>Fecha:</strong>{" "}
            {new Date(h.created_at).toLocaleString()}
          </p>
          {h.notes && (
            <p>
              <strong>Notas:</strong> {h.notes}
            </p>
          )}
        </div>
      ))}

      <button
        onClick={onClose}
        className="mt-2 text-blue-600 underline"
      >
        Cerrar historial
      </button>
    </aside>
  );
}
