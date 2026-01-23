"use client";

import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";

/* ================= VALIDACIONES ================= */
const hasUppercase = (v: string) => /[A-Z]/.test(v);
const hasNumber = (v: string) => /\d/.test(v);
const hasMinLength = (v: string) => v.length >= 8;

export default function ChangePassword() {
  const navigate = useNavigate();

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  const valid =
    hasMinLength(pw1) && hasUppercase(pw1) && hasNumber(pw1);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        navigate("/login", { replace: true });
      }
    })();
  }, [navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    if (!valid) {
      toast.error("La contraseña no cumple los requisitos");
      return;
    }

    if (pw1 !== pw2) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    try {
      setSaving(true);

      /* ===== ACTUALIZAR AUTH ===== */
      const { error: authErr } =
        await supabase.auth.updateUser({
          password: pw1,
        });

      if (authErr) throw authErr;

      /* ===== ACTUALIZAR PERFIL ===== */
      const { data: userData } = await supabase.auth.getUser();

      if (!userData?.user) {
        throw new Error("Usuario no encontrado");
      }

      const { error: profErr } = await supabase
        .from("profiles")
        .update({ force_password_change: false })
        .eq("id", userData.user.id);

      if (profErr) throw profErr;

      toast.success("Contraseña actualizada correctamente");

      navigate("/", { replace: true });

    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo cambiar la contraseña");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: `url('/bg-admin.png')` }}
    >
      <div className="absolute inset-0 bg-black/50" />

      <header className="relative z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3 text-white/90">
          <Link
            to="/login"
            className="h-9 w-9 rounded-lg bg-white/15 grid place-items-center ring-1 ring-white/20"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="mr-auto">
            <h1 className="text-lg font-semibold">
              UNEMI · Cambio de contraseña
            </h1>
            <p className="text-xs text-white/75">
              Primer acceso institucional
            </p>
          </div>
        </div>
      </header>

      <main className="relative z-10 min-h-[calc(100vh-64px)]">
        <div className="max-w-7xl mx-auto h-full px-4 md:px-6">
          <div className="flex h-[calc(100vh-64px)] items-center">
            <div className="hidden md:block md:basis-1/2 lg:basis-2/3" />

            <div className="w-full md:basis-1/2 lg:basis-1/3">
              <Card className="backdrop-blur-xl bg-white/10 border-white/20 text-white shadow-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="w-5 h-5" />
                    Establecer nueva contraseña
                  </CardTitle>
                  <CardDescription className="text-white/80">
                    Por seguridad, debes cambiar tu contraseña inicial.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-5">
                  <form onSubmit={onSubmit} className="space-y-4">
                    <div className="relative">
                      <Input
                        type={show ? "text" : "password"}
                        placeholder="Nueva contraseña"
                        value={pw1}
                        onChange={(e) => setPw1(e.target.value)}
                        className="pr-10 bg-white/90 text-black"
                      />
                      <button
                        type="button"
                        onClick={() => setShow((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                      >
                        {show ? (
                          <EyeOff className="h-4 w-4 text-black" />
                        ) : (
                          <Eye className="h-4 w-4 text-black" />
                        )}
                      </button>
                    </div>

                    <Input
                      type="password"
                      placeholder="Confirmar contraseña"
                      value={pw2}
                      onChange={(e) => setPw2(e.target.value)}
                      className="bg-white/90 text-black"
                    />

                    <ul className="text-xs space-y-1">
                      <li className={hasMinLength(pw1) ? "text-green-400" : "text-red-300"}>
                        • Mínimo 8 caracteres
                      </li>
                      <li className={hasUppercase(pw1) ? "text-green-400" : "text-red-300"}>
                        • Al menos una mayúscula
                      </li>
                      <li className={hasNumber(pw1) ? "text-green-400" : "text-red-300"}>
                        • Al menos un número
                      </li>
                    </ul>

                    <Button
                      type="submit"
                      disabled={!valid || saving}
                      className="w-full bg-white text-slate-900 hover:bg-white/90"
                    >
                      {saving ? "Guardando…" : "Guardar contraseña"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
