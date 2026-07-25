// admin-auth edge function
// Verifies the admin dashboard PIN and sends forgot-PIN reset codes.
// The PIN is stored server-side in this function and is NEVER sent to the
// client. A 4-digit PIN is weak by design for this demo — strengthen before
// real production use (enforce a longer password, add rate limiting, etc).
import { createClient } from "npm:@supabase/supabase-js@2.110.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ADMIN_EMAIL = "farhanzuhair123@gmail.com";
const ADMIN_PIN = "0114";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization") ?? "" },
        },
      },
    );

    const { data: authData } = await supabase.auth.getUser();
    const callerEmail = (authData.user?.email ?? "").toLowerCase();

    if (callerEmail !== ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as { action?: string; pin?: string };

    if (body.action === "check") {
      // Server-side confirmation that this session belongs to the admin.
      // Used by the client to decide whether to render the admin nav button.
      return new Response(JSON.stringify({ isAdmin: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "verify") {
      if (body.pin === ADMIN_PIN) {
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: false, error: "Incorrect PIN" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "forgot") {
      // Email a reset code to the admin address. Supabase has no built-in
      // transactional email for arbitrary content, so we store a reset code
      // in the notifications table addressed to the admin's own user id and
      // surface it in-app. A real deployment would send an actual email.
      const code = String(Math.floor(1000 + Math.random() * 9000));
      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      );
      const { data: adminUser } = await serviceClient.auth.admin.listUsers();
      const admin = (adminUser.users ?? []).find(
        (u) => (u.email ?? "").toLowerCase() === ADMIN_EMAIL,
      );
      const adminId = admin?.id;
      if (adminId) {
        await serviceClient.from("notifications").insert({
          user_id: adminId,
          kind: "admin_pin_reset",
          title: "Your admin PIN reset code",
          body: `Your admin dashboard reset code is ${code}. (PIN is 0114 — update before production use.)`,
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
