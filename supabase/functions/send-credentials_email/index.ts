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
      email,
      password,
      full_name,
      cedula,
      phone,
      address,
    } = await req.json();

    if (!email || !password || !full_name) {
      return new Response(
        JSON.stringify({ ok: false, error: "Datos incompletos" }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!email.toLowerCase().endsWith("@unemi.edu.ec")) {
      return new Response(
        JSON.stringify({ ok: false, error: "Correo no institucional" }),
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
       CREAR USUARIO (SIN CORREO SUPABASE)
    ================================ */
    const { data: userData, error: createError } =
      await supabase.auth.admin.createUser({
        email: email.toLowerCase(),
        password,
        email_confirm: true, // 🔴 CLAVE
        user_metadata: {
          full_name,
          cedula,
          phone,
          address,
          role: "STUDENT",
        },
      });

    if (createError || !userData?.user) {
      throw createError ?? new Error("No se pudo crear el usuario");
    }

    const userId = userData.user.id;

    /* ===============================
       TOKEN DE VERIFICACIÓN
    ================================ */
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h

    await supabase.from("verification_tokens").insert({
      user_id: userId,
      token,
      expires_at: expiresAt.toISOString(),
    });

    /* ===============================
       ORIGEN
    ================================ */
    const origin =
      req.headers.get("origin") ||
      req.headers.get("referer") ||
      "http://localhost:5173";

    const verifyUrl = `${origin.replace(/\/$/, "")}/verify?token=${token}`;

    /* ===============================
       GMAIL OAUTH2
    ================================ */
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
      <h2>UNEMI · Verificación de cuenta</h2>
      <p>Hola <strong>${full_name}</strong>,</p>
      <p>Para activar tu cuenta institucional, haz clic en el siguiente enlace:</p>
      <p>
        <a href="${verifyUrl}" target="_blank">
          Verificar cuenta
        </a>
      </p>
      <p>Este enlace vence en 24 horas.</p>
    `;

    const mime =
      `From: ${Deno.env.get("GMAIL_USER")}\r\n` +
      `To: ${email}\r\n` +
      `Subject: Acceso al sistema App Emergencia UNEMI (Verifica tu cuenta)\r\n` +
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

    /* ===============================
       RESPONSE
    ================================ */
    return new Response(
      JSON.stringify({
        ok: true,
        user_id: userId,
      }),
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error("❌ register-student-and-send-email:", error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error.message ?? "Error interno",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
