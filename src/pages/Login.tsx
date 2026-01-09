import { useRef, useEffect } from "react";
import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
  ArrowLeft,
} from "lucide-react";

import { Button } from "./../components/ui/button";
import { Input } from "./../components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "./../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./../components/ui/dialog";
import { Label } from "./../components/ui/label";
import { toast } from "sonner";

import { supabase } from "./../lib/supabase";
import { useAuth } from "./../contexts/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshRole, role } = useAuth();
  const redirectTo = (location.state as { from?: string })?.from ?? "/";

  const [tab, setTab] = useState<"login" | "register">("login");

  // ===================== LOGIN =====================
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loadingLogin, setLoadingLogin] = useState(false);

  const onSubmitLogin = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    setLoadingLogin(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: pw,
      });
      if (error) throw error;

      await refreshRole();

      await supabase.auth.signInWithPassword({
        email,
        password: pw,
      });

      navigate("/", { replace: true });

    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo iniciar sesión"
      );
    } finally {
      setLoadingLogin(false);
    }
  };

  // ===================== REGISTRO (ESTUDIANTE) =====================
  const [stuName, setStuName] = useState("");
  const [stuEmail, setStuEmail] = useState("");
  const [stuPw, setStuPw] = useState("");
  const [showStuPw, setShowStuPw] = useState(false);
  const [loadingReg, setLoadingReg] = useState(false);
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [cedula, setCedula] = useState("");
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);

  const isUnemiEmail = (e: string) =>
    e.toLowerCase().endsWith("@unemi.edu.ec");

  const hasUppercase = /[A-Z]/.test(stuPw);
  const hasNumber = /\d/.test(stuPw);
  const hasMinLength = stuPw.length >= 8;

  const isPasswordValid =
    hasUppercase && hasNumber && hasMinLength;

  const onSubmitRegister = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (!stuName.trim())
      return toast.error("Ingresa tu nombre completo");
    if (!isUnemiEmail(stuEmail))
      return toast.error("Usa tu correo institucional @unemi.edu.ec");
    if (!hasMinLength)
      return toast.error("La contraseña debe tener al menos 8 caracteres");
    if (!hasUppercase)
      return toast.error("La contraseña debe tener al menos una mayúscula");
    if (!hasNumber)
      return toast.error("La contraseña debe tener al menos un número");

    setLoadingReg(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: stuEmail,
        password: stuPw,
        options: {
          emailRedirectTo: `${window.location.origin}/verify`,
          data: {
            full_name: stuName,
            address,
            phone,
            cedula,
            role: "STUDENT",
            photo_base64: photoBase64,
          },
        },
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("already")) {
          toast.error(
            "Ese correo ya está registrado. Puedes recuperar tu contraseña."
          );
          setForgotEmail(stuEmail);
          setForgotOpen(true);
        } else {
          toast.error(error.message);
        }
        return;
      }

      toast.success("Te enviamos un correo para confirmar tu cuenta.");
      stopCamera();
      setPhotoBase64(null);
      setTab("login");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo completar el registro"
      );
    } finally {
      setLoadingReg(false);
    }
  };

  // ===================== RECUPERAR CONTRASEÑA =====================
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");

  const sendRecovery = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    const mail = (forgotEmail || email).trim();
    if (!mail)
      return toast.info("Ingresa tu correo institucional.");

    try {
      await supabase.auth.resetPasswordForEmail(mail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      toast.success("Te enviamos un enlace para restablecer la contraseña.");
      setForgotOpen(false);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo enviar el enlace"
      );
    }
  };

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    if (tab !== "register") return;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" } })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      });

    return () => {
      const stream = videoRef.current?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [tab]);

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx?.drawImage(video, 0, 0);

    setPhotoBase64(canvas.toDataURL("image/jpeg"));
  };

  // ===================== RENDER =====================
  return (
    <div className="login-bg min-h-screen w-full bg-cover bg-center bg-no-repeat relative">
      <div className="absolute inset-0 bg-black/50" />

      <header className="relative z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3 text-white/90">
          
          <div className="mr-auto">
            <h1 className="text-lg font-semibold leading-tight">
              UNEMI Botón Emergente · Acceso
            </h1>
            
          </div>
        </div>
      </header>

      <main className="relative z-10 min-h-[calc(100vh-64px)]">
        <div className="max-w-7xl mx-auto h-full px-4 md:px-6">
          <div className="flex h-[calc(100vh-64px)] items-center">
            
            <div className="w-full md:basis-1/2 lg:basis-1/3">
              <Card className="backdrop-blur-xl bg-white/10 border-white/20 text-white shadow-2xl">
                <CardHeader className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-2xl font-semibold">
                      {tab === "login"
                        ? "Iniciar sesión"
                        : "Registro estudiante"}
                    </CardTitle>
                  </div>
                  <CardDescription className="text-white/80">
                    {tab === "login"
                      ? "Usa tus credenciales institucionales para acceder al panel."
                      : "Crea tu cuenta con correo institucional (@unemi.edu.ec)."}
                  </CardDescription>

                  <div className="mt-3 inline-flex rounded-lg overflow-hidden ring-1 ring-white/20">
                    <button
                      className={`px-3 py-1.5 text-sm ${
                        tab === "login"
                          ? "bg-white text-slate-900"
                          : "bg-transparent text-white/80"
                      }`}
                      onClick={() => {
                        stopCamera();
                        setTab("login");
                      }}
                    >
                      Iniciar sesión
                    </button>
                    <button
                      className={`px-3 py-1.5 text-sm ${
                        tab === "register"
                          ? "bg-white text-slate-900"
                          : "bg-transparent text-white/80"
                      }`}
                      onClick={() => setTab("register")}
                    >
                      Registro estudiante
                    </button>
                  </div>
                </CardHeader>

                <CardContent
                  className={
                    tab === "register"
                      ? "max-h-[65vh] overflow-y-auto pr-2"
                      : ""
                  }
                >
                  {tab === "login" ? (
                    <form
                      onSubmit={onSubmitLogin}
                      className="grid gap-5"
                      autoComplete="on"
                    >
                      <div className="grid gap-2">
                        <label className="text-sm text-white/90">
                          Correo
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black" />
                          <Input
                            type="email"
                            autoComplete="username"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="tucorreo@unemi.edu.ec"
                            required
                            className="pl-9 bg-white/90 text-black"
                          />
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <label className="text-sm text-white/90">
                          Contraseña
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black" />
                          <Input
                            type={showPw ? "text" : "password"}
                            autoComplete="current-password"
                            value={pw}
                            onChange={(e) => setPw(e.target.value)}
                            required
                            className="pl-9 pr-10 bg-white/90 text-slate-900"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPw((s) => !s)}
                            className="absolute right-3 top-1/2 -translate-y-1/2"
                          >
                            {showPw ? (
                              <EyeOff className="h-4 w-4 text-black" />
                            ) : (
                              <Eye className="h-4 w-4 text-black" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setForgotOpen(true)}
                          className="text-xs underline text-white/80"
                        >
                          ¿Olvidaste tu contraseña?
                        </button>
                        <Button type="submit" disabled={loadingLogin}>
                          <LogIn className="mr-2 h-4 w-4" />
                          {loadingLogin ? "Ingresando…" : "Ingresar"}
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <form onSubmit={onSubmitRegister} className="grid gap-5">
                      <div className="grid gap-2">
                        <label className="text-sm text-white/90">Nombre completo</label>
                        <Input
                          value={stuName}
                          onChange={(e) => setStuName(e.target.value)}
                          required
                          className="bg-white/90 text-slate-900"
                        />
                      </div>

                      <div className="grid gap-2">
                        <label className="text-sm text-white/90">Dirección domiciliaria</label>
                        <Input
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          required
                          className="bg-white/90 text-slate-900"
                        />
                      </div>

                      <div className="grid gap-2">
                        <label className="text-sm text-white/90">Teléfono</label>
                        <Input
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          required
                          className="bg-white/90 text-slate-900"
                        />
                      </div>

                      <div className="grid gap-2">
                        <label className="text-sm text-white/90">Cédula</label>
                        <Input
                          value={cedula}
                          onChange={(e) => setCedula(e.target.value)}
                          required
                          className="bg-white/90 text-slate-900"
                        />
                      </div>

                      <div className="grid gap-2">
                        <label className="text-sm text-white/90">Correo institucional</label>
                        <Input
                          type="email"
                          value={stuEmail}
                          onChange={(e) => setStuEmail(e.target.value)}
                          required
                          className="bg-white/90 text-slate-900"
                        />
                      </div>

                      <div className="grid gap-2">
                        <label className="text-sm text-white/90">Contraseña</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black" />
                          <Input
                            type={showStuPw ? "text" : "password"}
                            value={stuPw}
                            onChange={(e) => setStuPw(e.target.value)}
                            required
                            className="pl-9 pr-10 bg-white/90 text-slate-900"
                          />
                          <button
                            type="button"
                            onClick={() => setShowStuPw((s) => !s)}
                            className="absolute right-3 top-1/2 -translate-y-1/2"
                          >
                            {showStuPw ? (
                              <EyeOff className="h-4 w-4 text-black" />
                            ) : (
                              <Eye className="h-4 w-4 text-black" />
                            )}
                          </button>
                        </div>

                        <ul className="text-xs space-y-1 mt-1">
                          <li className={hasMinLength ? "text-green-400" : "text-red-300"}>
                            • Mínimo 8 caracteres
                          </li>
                          <li className={hasUppercase ? "text-green-400" : "text-red-300"}>
                            • Al menos una mayúscula
                          </li>
                          <li className={hasNumber ? "text-green-400" : "text-red-300"}>
                            • Al menos un número
                          </li>
                        </ul>
                      </div>

                      {/* CÁMARA */}
                      <div className="grid gap-2">
                        <label className="text-sm text-white/90">Fotografía</label>

                        {!photoBase64 ? (
                          <>
                            <video
                              ref={videoRef}
                              autoPlay
                              playsInline
                              className="rounded-md border bg-black"
                            />
                            <canvas ref={canvasRef} className="hidden" />
                            <Button type="button" onClick={takePhoto}>
                              Tomar fotografía
                            </Button>
                          </>
                        ) : (
                          <img
                            src={photoBase64}
                            className="rounded-md border"
                            alt="Foto capturada"
                          />
                        )}
                      </div>

                      <Button
                        type="submit"
                        disabled={loadingReg || !photoBase64 || !isPasswordValid}
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        {loadingReg ? "Registrando…" : "Registrarme"}
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restablecer contraseña</DialogTitle>
            <DialogDescription>
              Ingresa tu correo institucional
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={sendRecovery} className="grid gap-4">
            <Label>Correo</Label>
            <Input
              type="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              required
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setForgotOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">Enviar enlace</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
