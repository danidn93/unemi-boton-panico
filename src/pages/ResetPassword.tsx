import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "sonner";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password.length < 8) {
      return toast.error("La contraseña debe tener al menos 8 caracteres");
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });
      if (error) throw error;

      toast.success("Contraseña actualizada");
      navigate("/login", { replace: true });
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? err.message
          : "No se pudo actualizar la contraseña"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <form
        onSubmit={handleReset}
        className="bg-white rounded-lg p-6 w-full max-w-sm space-y-4"
      >
        <h1 className="text-xl font-semibold text-slate-900">
          Nueva contraseña
        </h1>

        <Input
          type="password"
          placeholder="Nueva contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Guardando…" : "Cambiar contraseña"}
        </Button>
      </form>
    </div>
  );
}
