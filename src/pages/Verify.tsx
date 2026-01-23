"use client";

import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  CheckCircle2,
  XCircle,
  MailCheck,
  ArrowLeft,
  Home,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

type Status = "checking" | "ok" | "error";

type VerifyResp = {
  ok: boolean;
  error?: string;
  prev_status?: "invalid" | "expired" | "unused" | "used";
  new_status?: "invalid" | "expired" | "verified" | "already_verified";
  user_id?: string;
  email?: string;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function VerifyPage() {
  const [params] = useSearchParams();
  const token = params.get("token");

  const ran = useRef(false);

  const [status, setStatus] = useState<Status>("checking");
  const [msg, setMsg] = useState<string>("Validando tu enlace…");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMsg("Token inválido.");
      return;
    }

    if (ran.current) return;
    ran.current = true;

    (async () => {
      try {
        setStatus("checking");
        setMsg("Validando tu enlace…");

        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/verify-student`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ token }),
          }
        );

        const data: VerifyResp = await res.json();

        if (!res.ok || !data.ok) {
          setStatus("error");
          setMsg(data?.error ?? "No se pudo verificar el enlace.");
          toast.error(data?.error ?? "No se pudo verificar el enlace.");
          return;
        }

        setStatus("ok");

        if (data.new_status === "already_verified") {
          setMsg("Tu cuenta ya estaba verificada. Puedes iniciar sesión.");
        } else if (data.new_status === "verified") {
          setMsg(
            "¡Correo verificado correctamente! Tu cuenta de estudiante quedó activa."
          );
        } else {
          setMsg("Verificación completada. Ya puedes iniciar sesión.");
        }
      } catch (e: any) {
        console.error("[verify] error:", e);
        setStatus("error");
        setMsg(e?.message ?? "No se pudo verificar el enlace.");
        toast.error(e?.message ?? "No se pudo verificar el enlace.");
      }
    })();
  }, [token]);

  return (
    <div
      className="min-h-screen w-full bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: `url('/bg-admin.png')` }}
    >
      <div className="absolute inset-0 bg-black/50" />

      <header className="relative z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3 text-white/90">
          <Link
            to="/"
            className="h-9 w-9 rounded-lg bg-white/15 grid place-items-center ring-1 ring-white/20"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div className="mr-auto">
            <h1 className="text-lg font-semibold leading-tight">
              UNEMI Campus · Verificación
            </h1>
            <p className="text-xs text-white/75">
              Activación de cuenta de estudiante
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
                    <MailCheck className="w-5 h-5" />
                    Verificación de correo
                  </CardTitle>
                  <CardDescription className="text-white/80">
                    Procesando tu enlace de confirmación…
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                  <div className="flex items-center gap-3 text-white/90">
                    {status === "checking" && (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin text-white/80" />
                        <span>{msg}</span>
                      </>
                    )}
                    {status === "ok" && (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-green-300" />
                        <span>{msg}</span>
                      </>
                    )}
                    {status === "error" && (
                      <>
                        <XCircle className="w-5 h-5 text-red-300" />
                        <span>{msg}</span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <Link to="/">
                      <Button
                        variant="outline"
                        className="bg-white text-slate-900 hover:bg-white/90"
                      >
                        <Home className="w-4 h-4 mr-2" />
                        Inicio
                      </Button>
                    </Link>

                    <Link to="/login">
                      <Button className="bg-white text-slate-900 hover:bg-white/90">
                        <p className="text-black">Ir a iniciar sesión</p>
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
