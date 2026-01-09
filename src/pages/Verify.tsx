import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Verify() {
  const navigate = useNavigate();

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user) return;

      const meta = user.user_metadata;

      // Subir foto
      const base64 = meta.photo_base64.split(",")[1];
      const path = `profiles/${user.id}.jpg`;

      await supabase.storage
        .from("profiles")
        .upload(path, Uint8Array.from(atob(base64), c => c.charCodeAt(0)), {
          contentType: "image/jpeg",
          upsert: true,
        });

      // Crear perfil
      await supabase.from("profiles").insert({
        id: user.id,
        full_name: meta.full_name,
        address: meta.address,
        phone: meta.phone,
        institutional_email: user.email,
        cedula: meta.cedula,
        role: meta.role,
        photo_path: path,
      });

      navigate("/");
    };

    run();
  }, [navigate]);

  return (
    <div className="h-screen flex items-center justify-center">
      <p>Verificando cuenta, por favor espera…</p>
    </div>
  );
}
