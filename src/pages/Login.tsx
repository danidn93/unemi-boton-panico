
import { useState, useEffect } from "react";
import { useNavigate, } from "react-router-dom";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
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
  const { refreshRole} = useAuth();

  const [tab, setTab] = useState<"login" | "register">("login");

  // ===================== LOGIN =====================
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loadingLogin, setLoadingLogin] = useState(false);

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [needsTerms, setNeedsTerms] = useState<boolean | null>(null);

  const onSubmitLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (loadingLogin) return;
    setLoadingLogin(true);

    if (needsTerms && !termsAccepted) {
      toast.error("Debes aceptar los Términos y Condiciones para continuar");
      return;
    }

    try {
      /* ================= LOGIN ================= */
      const { data: loginData, error } =
        await supabase.auth.signInWithPassword({
          email,
          password: pw,
        });

      if (error || !loginData.user) {
        throw error ?? new Error("Credenciales inválidas");
      }

      const userId = loginData.user.id;

      /* ================= PERFIL ================= */
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, force_password_change, active")
        .eq("id", userId)
        .single();

      if (profileError || !profile) {
        throw new Error("No se pudo cargar el perfil del usuario");
      }

      if (!profile.active) {
        throw new Error("Tu cuenta se encuentra desactivada");
      }

      /* ================= FORZAR CAMBIO CLAVE ================= */
      if (profile.force_password_change) {
        navigate("/change-password", { replace: true });
        return;
      }

      /* ================= ROL / CONTEXTO ================= */
      await refreshRole();
      if (needsTerms && termsAccepted) {
        await supabase
          .from("profiles")
          .update({
            accepted_terms: true,
            accepted_terms_at: new Date().toISOString(),
          })
          .eq("id", userId);
      }

      navigate("/", { replace: true });

    } catch (err: any) {
      const msg =
        err?.message?.includes("Invalid login")
          ? "Credenciales incorrectas. Si es tu primer acceso, usa tu cédula como contraseña."
          : err?.message ?? "No se pudo iniciar sesión";

      toast.error(msg);
    } finally {
      setLoadingLogin(false);
    }
  };

  useEffect(() => {
    if (!email || !email.includes("@")) return;

    const checkTerms = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("accepted_terms")
        .eq("institutional_email", email.toLowerCase())
        .maybeSingle();

      if (!data) {
        setNeedsTerms(true); // usuario nuevo o sin perfil
      } else {
        setNeedsTerms(!data.accepted_terms);
      }
    };

    checkTerms();
  }, [email]);

  // ===================== REGISTRO (ESTUDIANTE) =====================
  const [stuName, setStuName] = useState("");
  const [stuEmail, setStuEmail] = useState("");
  const [stuPw, setStuPw] = useState("");
  const [showStuPw, setShowStuPw] = useState(false);
  const [loadingReg, setLoadingReg] = useState(false);
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [cedula, setCedula] = useState("");

  const isUnemiEmail = (e: string) =>
    e.toLowerCase().endsWith("@unemi.edu.ec");

  const hasUppercase = /[A-Z]/.test(stuPw);
  const hasNumber = /\d/.test(stuPw);
  const hasMinLength = stuPw.length >= 8;

  const isPasswordValid =
    hasUppercase && hasNumber && hasMinLength;

  const onSubmitRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // 🔴 BLOQUEO ABSOLUTO ANTI DOBLE SUBMIT
    if (loadingReg) return;
    setLoadingReg(true);

    try {
      /* ================= VALIDACIONES ================= */

      if (!stuName.trim()) {
        toast.error("Ingresa tu nombre completo");
        return;
      }

      if (!isUnemiEmail(stuEmail)) {
        toast.error("Debes usar tu correo institucional @unemi.edu.ec");
        return;
      }

      if (!hasMinLength || !hasUppercase || !hasNumber) {
        toast.error("La contraseña no cumple los requisitos de seguridad");
        return;
      }

      if (!cedula.trim() || !phone.trim() || !address.trim()) {
        toast.error("Completa todos los campos obligatorios");
        return;
      }

      /* ================= REGISTRO VÍA EDGE FUNCTION ================= */

      const email = stuEmail.trim().toLowerCase();

      const { data, error } = await supabase.functions.invoke(
        "send-credentials_email",
        {
          body: {
            email,
            password: stuPw,
            full_name: stuName.trim(),
            cedula: cedula.trim(),
            phone: phone.trim(),
            address: address.trim(),
          },
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.ok) {
        throw new Error(data?.error ?? "No se pudo crear la cuenta");
      }

      /* ================= ÉXITO ================= */

      toast.success(
        "Cuenta creada correctamente. Revisa tu correo institucional para verificarla."
      );

      /* ================= LIMPIEZA / UX ================= */

      setStuName("");
      setStuEmail("");
      setStuPw("");
      setCedula("");
      setPhone("");
      setAddress("");
      setShowStuPw(false);
      setTab("login");

    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo completar el registro");
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
                        {needsTerms === true && (
                          <div className="flex items-start gap-3 text-xs text-white/90">
                            <input
                              type="checkbox"
                              checked={termsAccepted}
                              onChange={(e) => setTermsAccepted(e.target.checked)}
                              className="mt-0.5"
                            />
                            <span>
                              Acepto los{" "}
                              <button
                                type="button"
                                className="underline text-white"
                                onClick={() => setShowTerms(true)}
                              >
                                Términos y Condiciones
                              </button>
                            </span>
                          </div>
                        )}
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
                        <label className="text-sm text-white/90">Teléfono (Cón código del país)</label>
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

                      <Button
                        type="submit"
                        disabled={loadingReg || !isPasswordValid}
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
      <Dialog open={showTerms} onOpenChange={setShowTerms}>
        <DialogContent className="safe-area sm:max-w-lg p-0">
          {/* Contenedor interno con padding real */}
          <div className="max-h-[80vh] overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">

            <DialogHeader className="space-y-1">
              <DialogTitle className="text-lg font-semibold">
                Términos y Condiciones de Uso
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-600">
                Reglamento de Régimen Disciplinario – UNEMI
              </DialogDescription>
            </DialogHeader>

            {/* Contenido */}
            <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-700">
              <p>
                El uso del sistema <strong>Botón Emergente UNEMI</strong> se rige por el
                <strong>
                  {" "}
                  Reglamento de Régimen Disciplinario para los Estudiantes y Miembros
                  del Personal Académico de la Universidad Estatal de Milagro
                </strong>,
                aprobado por el Órgano Colegiado Superior y vigente a la fecha.
              </p>

              <p>
                El usuario se compromete a utilizar esta funcionalidad únicamente
                ante situaciones reales de emergencia dentro de los predios
                universitarios.
              </p>

              <p>
                De conformidad con el Reglamento, el uso indebido de los sistemas
                informáticos institucionales, la generación de alertas falsas o la
                alteración de información constituye una falta disciplinaria y podrá
                ser sancionada conforme a la normativa interna vigente.
              </p>

              <p>
                Toda alerta registrada queda asociada al usuario autenticado y podrá
                ser utilizada como evidencia en procesos administrativos o
                disciplinarios, sin perjuicio de las acciones civiles o penales a las
                que hubiere lugar.
              </p>

              <p>
                La Universidad garantizará la confidencialidad de la información
                tratada, conforme a la normativa institucional, evitando la
                revictimización y el uso indebido de los datos.
              </p>

              <p className="pt-3 text-xs text-slate-500">
                Referencia normativa: Reglamento de Régimen Disciplinario UNEMI,
                primera versión 01-11-2022, última reforma 23-01-2025.
              </p>
            </div>
            <div className="sticky bottom-0 mt-6 pt-4 bg-white">
            <Button
              type="button"
              className="w-full"
              onClick={() => setShowTerms(false)}
            >
              Cerrar
            </Button>
          </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
