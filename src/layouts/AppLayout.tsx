import { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { LogOut, KeyRound, UserCircle2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import ResetPasswordModal from "./../components/ResetPassWordModal";

export default function AppLayout() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [openReset, setOpenReset] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Sesión cerrada");
    navigate("/login", { replace: true });
  };

  return (
    <div className="h-screen w-full flex flex-col">
      {/* ===== NAVBAR ===== */}
      <header className="h-14 flex items-center justify-between px-4 bg-[#0f2230] text-white">
        <div className="font-semibold">UNEMI · Botón de Pánico</div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm opacity-90">
            <UserCircle2 className="w-5 h-5" />
            {role}
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setOpenReset(true)}
          >
            <KeyRound className="w-4 h-4 mr-1" />
            Cambiar clave
          </Button>

          <Button
            size="sm"
            variant="destructive"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-1" />
            Salir
          </Button>
        </div>
      </header>

      {/* ===== CONTENIDO ===== */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>

      {/* ===== MODAL ===== */}
      <ResetPasswordModal
        open={openReset}
        onClose={() => setOpenReset(false)}
      />
    </div>
  );
}
