import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return reply({ error: "Backend belum dikonfigurasi." }, 503);

  try {
    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return reply({ error: "Login diperlukan." }, 401);
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return reply({ error: "Sesi login tidak valid." }, 401);

    const body = await request.json().catch(() => ({}));
    const businessName = String(body?.business_name || "").trim().slice(0, 120);
    const businessType = String(body?.business_type || "Usaha lainnya").trim().slice(0, 80);
    const fullName = String(body?.full_name || "").trim().slice(0, 120);
    const whatsapp = String(body?.whatsapp || "").trim().slice(0, 30);
    if (!businessName) return reply({ error: "Nama usaha wajib diisi." }, 400);

    // Make onboarding idempotent if the client retries after the first insert succeeded.
    const { data: memberships, error: membershipError } = await admin.from("tenant_users")
      .select("tenant_id,role,is_active")
      .eq("user_id", authData.user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(5);
    if (membershipError) throw membershipError;

    const existingOwner = (memberships || []).find((row: any) =>
      ["owner", "admin"].includes(String(row.role || "").toLowerCase())
    );
    if (existingOwner?.tenant_id) {
      const { data: existingTenant, error: existingTenantError } = await admin.from("tenants")
        .select("id,tenant_code,business_name,business_type,address,city,province,status,ai_enabled")
        .eq("id", existingOwner.tenant_id).maybeSingle();
      if (existingTenantError) throw existingTenantError;
      if (existingTenant && ["active", "trial"].includes(String(existingTenant.status || "").toLowerCase())) {
        return reply({ tenant: existingTenant, existing: true });
      }
      return reply({ error: "Tenant akun ini belum aktif. Hubungi admin platform." }, 409);
    }
    if ((memberships || []).length > 0) {
      return reply({ error: "Akun ini sudah menjadi anggota tenant. Pilih tenant tersebut, atau minta owner mengatur akses." }, 409);
    }

    const tenantCode = "WACS-" + crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase();
    const { data: tenant, error: tenantError } = await admin.from("tenants").insert({
      tenant_code: tenantCode,
      business_name: businessName,
      business_type: businessType || "Usaha lainnya",
      whatsapp: whatsapp || null,
      email: authData.user.email || null,
      status: "trial",
      ai_enabled: true,
    }).select("id,tenant_code,business_name,business_type,address,city,province,status,ai_enabled").single();
    if (tenantError) throw tenantError;

    const membershipEmail = authData.user.email || (String(authData.user.id) + "@no-email.invalid");
    const { error: ownerError } = await admin.from("tenant_users").insert({
      tenant_id: tenant.id,
      user_id: authData.user.id,
      email: membershipEmail,
      full_name: fullName || null,
      role: "owner",
      is_active: true,
    });
    if (ownerError) {
      // Roll back only the tenant row created by this request to avoid an orphan.
      const { error: cleanupError } = await admin.from("tenants").delete().eq("id", tenant.id);
      if (cleanupError) console.error("Could not clean up incomplete tenant:", cleanupError.message);
      throw ownerError;
    }

    // The WHATSAPP-CS app trial is started later by jfs_get_my_app_subscription
    // after the UI independently verifies tenant ownership. Do not create a legacy
    // tenant_subscriptions row for this app here.
    return reply({ tenant, created: true });
  } catch (error) {
    console.error("WhatsApp CS tenant onboarding failed:", error instanceof Error ? error.message : String(error));
    return reply({ error: "Gagal menyiapkan tenant. Periksa data dan coba lagi." }, 500);
  }
});
