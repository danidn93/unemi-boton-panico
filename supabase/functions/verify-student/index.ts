import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type PrevStatus = "invalid" | "expired" | "unused" | "used";
type NewStatus = "invalid" | "expired" | "verified" | "already_verified";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Método no permitido" }, 405);

  try {
    const { token } = await req.json();
    if (!token) return json({ ok: false, error: "Token requerido", prev_status: "invalid", new_status: "invalid" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1) Buscar token (incluye usados)
    const { data: vt, error: vtErr } = await supabase
      .from("verification_tokens")
      .select("*")
      .eq("token", token)
      .single();

    if (vtErr || !vt) {
      return json({ ok: false, error: "Token inválido", prev_status: "invalid" as PrevStatus, new_status: "invalid" as NewStatus });
    }

    const prev_status: PrevStatus = vt.used ? "used" : "unused";

    // 2) Expiración solo si NO fue usado
    if (!vt.used && new Date(vt.expires_at) < new Date()) {
      return json({
        ok: false,
        error: "Token expirado",
        prev_status,
        new_status: "expired" as NewStatus,
      });
    }

    // 3) Obtener usuario auth
    const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(vt.user_id);
    if (userErr || !userData?.user) {
      return json({ ok: false, error: "Usuario no encontrado", prev_status, new_status: "invalid" as NewStatus });
    }

    const user = userData.user;
    const meta = user.user_metadata ?? {};

    // 4) Upsert profile (idempotente)
    await supabase.from("profiles").upsert(
      {
        id: user.id,
        institutional_email: user.email,
        full_name: meta.full_name,
        cedula: meta.cedula,
        phone: meta.phone,
        address: meta.address,
        role: meta.role ?? "STUDENT",
        active: true,
      },
      { onConflict: "id" }
    );

    // 5) Marcar token usado si aplica
    let new_status: NewStatus = "already_verified";
    if (!vt.used) {
      await supabase.from("verification_tokens").update({ used: true }).eq("id", vt.id);
      new_status = "verified";
    }

    return json({
      ok: true,
      prev_status,
      new_status,
      user_id: user.id,
      email: user.email,
    });
  } catch (e: any) {
    console.error("❌ verify-student:", e);
    // Importante: devolvemos 200 con ok=false para que invoke lo trate en `data`
    return json({ ok: false, error: e?.message ?? "Error de verificación", prev_status: "invalid", new_status: "invalid" });
  }
});
