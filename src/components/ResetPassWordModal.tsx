import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ResetPasswordModal({ open, onClose }: Props) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // ===== VALIDACIONES =====
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasMinLength = password.length >= 8;
  const passwordsMatch = password === confirmPassword;

  const isValid =
    hasUppercase && hasNumber && hasMinLength && passwordsMatch;

  const handleChangePassword = async () => {
    if (!hasMinLength) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (!hasUppercase) {
      toast.error("La contraseña debe tener al menos una mayúscula");
      return;
    }
    if (!hasNumber) {
      toast.error("La contraseña debe tener al menos un número");
      return;
    }
    if (!passwordsMatch) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      password,
    });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Contraseña actualizada correctamente");
    setPassword("");
    setConfirmPassword("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambiar contraseña</DialogTitle>
          <DialogDescription>
            La contraseña debe tener mínimo 8 caracteres, una mayúscula y un número.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Input
            type="password"
            placeholder="Nueva contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Input
            type="password"
            placeholder="Confirmar nueva contraseña"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          {/* ===== VALIDACIONES VISUALES ===== */}
          <ul className="text-xs space-y-1">
            <li className={hasMinLength ? "text-green-600" : "text-red-500"}>
              • Mínimo 8 caracteres
            </li>
            <li className={hasUppercase ? "text-green-600" : "text-red-500"}>
              • Al menos una mayúscula
            </li>
            <li className={hasNumber ? "text-green-600" : "text-red-500"}>
              • Al menos un número
            </li>
            <li className={passwordsMatch ? "text-green-600" : "text-red-500"}>
              • Las contraseñas coinciden
            </li>
          </ul>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleChangePassword} disabled={!isValid || loading}>
              {loading ? "Guardando..." : "Actualizar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
