import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { google } from "npm:googleapis@140";
import { OAuth2Client } from "npm:google-auth-library@9";

/* ===============================
   CORS
================================ */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    /* ===============================
       BODY
    ================================ */
    const {
      full_name,
      institutional_email,
      cedula,
      phone,
      address,
      role,        // STAFF | OPERATOR
      department,  // BIENESTAR | SALUD_OCUPACIONAL | null
      campus_id,
      sede_id,
    } = await req.json();

    if (!full_name || !institutional_email || !cedula || !role) {
      return new Response(
        JSON.stringify({ ok: false, error: "Datos obligatorios incompletos" }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!institutional_email.toLowerCase().endsWith("@unemi.edu.ec")) {
      return new Response(
        JSON.stringify({ ok: false, error: "Correo no institucional" }),
        { status: 400, headers: corsHeaders }
      );
    }

    /* ===============================
       VALIDACIÓN DE ROLES
    ================================ */
    if (!["STAFF", "OPERATOR"].includes(role)) {
      return new Response(
        JSON.stringify({ ok: false, error: "Rol inválido" }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (role === "OPERATOR") {
      if (!["BIENESTAR", "SALUD_OCUPACIONAL"].includes(department)) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "El operador debe tener un departamento válido",
          }),
          { status: 400, headers: corsHeaders }
        );
      }
    }

    if (role === "STAFF" && department) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "STAFF no puede tener departamento",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    /* ===============================
       SUPABASE (SERVICE ROLE)
    ================================ */
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    /* ===============================
       CREAR USUARIO AUTH
       - password inicial = cédula
    ================================ */
    const { data: userData, error: authError } =
      await supabase.auth.admin.createUser({
        email: institutional_email.toLowerCase(),
        password: cedula,
        email_confirm: true,
        user_metadata: {
          full_name,
          cedula,
          role,
        },
      });

    if (authError || !userData?.user) {
      throw authError ?? new Error("No se pudo crear el usuario");
    }

    const userId = userData.user.id;

    /* ===============================
       INSERT PROFILE
    ================================ */
    const { error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: userId,
        full_name,
        address: address ?? null,
        phone: phone ?? null,
        institutional_email: institutional_email.toLowerCase(),
        cedula,
        photo_path: null,
        role,
        department: role === "OPERATOR" ? department : null,
        active: true,
        campus_id: campus_id ?? null,
        sede_id: sede_id ?? null,
        false_alert: 0,
        force_password_change: true,
      });

    if (profileError) throw profileError;

    /* ===============================
       CORREO
    ================================ */
    const origin =
      req.headers.get("origin") ||
      req.headers.get("referer") ||
      "http://localhost:5173";

    const loginUrl = `${origin.replace(/\/$/, "")}/login`;

    const oauth2Client = new OAuth2Client(
      Deno.env.get("GOOGLE_CLIENT_ID"),
      Deno.env.get("GOOGLE_CLIENT_SECRET"),
      "https://developers.google.com/oauth2"
    );

    oauth2Client.setCredentials({
      refresh_token: Deno.env.get("GOOGLE_REFRESH_TOKEN"),
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const html = `
      <h2>UNEMI · Acceso institucional</h2>
      <p>Hola <strong>${full_name}</strong>,</p>
      <p>Tu cuenta ha sido creada con éxito.</p>
      <ul>
        <li><strong>Usuario:</strong> ${institutional_email}</li>
        <li><strong>Contraseña inicial:</strong> tu número de cédula</li>
      </ul>
      <p>Al iniciar sesión deberás cambiar tu contraseña.</p>
      <p>
        <a href="${loginUrl}" target="_blank">Iniciar sesión</a>
      </p>
    `;

    const mime =
      `From: ${Deno.env.get("GMAIL_USER")}\r\n` +
      `To: ${institutional_email}\r\n` +
      `Subject: Acceso al sistema App Emergencia UNEMI\r\n` +
      `MIME-Version: 1.0\r\n` +
      `Content-Type: text/html; charset=UTF-8\r\n\r\n` +
      html;

    const raw = btoa(unescape(encodeURIComponent(mime)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });

    return new Response(
      JSON.stringify({ ok: true, user_id: userId }),
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error("❌ create-staff:", error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
