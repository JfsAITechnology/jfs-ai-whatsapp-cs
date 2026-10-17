import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";
const GRAPH_VERSION = Deno.env.get("WHATSAPP_GRAPH_VERSION") || "v23.0";
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
const digits = (value: string) => value.replace(/\D/g, "");

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: "Backend Supabase belum dikonfigurasi." }, 503);
  if (!WHATSAPP_ACCESS_TOKEN) return json({
    error: "WHATSAPP_ACCESS_TOKEN belum disetel pada Supabase Edge Function secrets. Nomor belum dihubungkan.",
  }, 503);

  try {
    const authorization = request.headers.get("authorization") || "";
    const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) return json({ error: "Login diperlukan." }, 401);
    const { data: authData, error: authError } = await db.auth.getUser(accessToken);
    if (authError || !authData.user) return json({ error: "Sesi login tidak valid. Silakan login ulang." }, 401);

    const body = await request.json();
    const tenantCode = String(body?.tenant_code || "").trim();
    const phoneNumberId = String(body?.phone_number_id || "").trim();
    const suppliedPhone = String(body?.phone || "").trim();
    if (!tenantCode) return json({ error: "Kode tenant wajib diisi." }, 400);
    if (!/^\d{5,30}$/.test(phoneNumberId)) return json({ error: "Phone Number ID Meta harus berupa angka yang valid." }, 400);

    const { data: tenant, error: tenantError } = await db.from("tenants")
      .select("id,tenant_code,business_name,status,ai_enabled")
      .eq("tenant_code", tenantCode).maybeSingle();
    if (tenantError) throw tenantError;
    if (!tenant || !["active", "trial"].includes(String(tenant.status || "").toLowerCase()) || tenant.ai_enabled !== true) {
      return json({ error: "Tenant tidak aktif atau AI belum diaktifkan." }, 403);
    }

    const { data: memberships, error: membershipError } = await db.from("tenant_users")
      .select("role,is_active")
      .eq("tenant_id", tenant.id)
      .eq("user_id", authData.user.id)
      .eq("is_active", true)
      .limit(2);
    if (membershipError) throw membershipError;
    if (!(memberships || []).some((m: any) => ["owner", "admin"].includes(String(m.role || "").toLowerCase()))) {
      return json({ error: "Hanya pemilik atau admin tenant yang dapat menghubungkan WhatsApp." }, 403);
    }

    const metaResponse = await fetch(
      "https://graph.facebook.com/" + GRAPH_VERSION + "/" + encodeURIComponent(phoneNumberId) +
        "?fields=id,display_phone_number,verified_name",
      { headers: { authorization: "Bearer " + WHATSAPP_ACCESS_TOKEN, accept: "application/json" } },
    );
    const metaData = await metaResponse.json().catch(() => ({}));
    if (!metaResponse.ok || String(metaData?.id || "") !== phoneNumberId) {
      const detail = String(metaData?.error?.message || "Meta tidak dapat memverifikasi Phone Number ID ini.");
      return json({ error: "Verifikasi Meta gagal: " + detail.slice(0, 300) }, 422);
    }

    const verifiedPhone = String(metaData.display_phone_number || suppliedPhone).trim();
    if (suppliedPhone && verifiedPhone && digits(suppliedPhone) !== digits(verifiedPhone)) {
      return json({
        error: "Nomor WhatsApp yang diisi tidak cocok dengan nomor dari Meta (" + verifiedPhone + ").",
      }, 400);
    }

    const { data: channelOwner, error: channelOwnerError } = await db.from("jfs_channel_connections")
      .select("tenant_id")
      .eq("channel", "whatsapp")
      .filter("metadata->>phone_number_id", "eq", phoneNumberId)
      .maybeSingle();
    if (channelOwnerError) throw channelOwnerError;
    if (channelOwner && channelOwner.tenant_id !== tenant.id) {
      return json({ error: "Nomor WhatsApp tersebut sudah terhubung ke tenant lain. Hubungi admin jika ini kekeliruan." }, 409);
    }

    const { data: existingRows, error: existingError } = await db.from("jfs_channel_connections")
      .select("id,metadata")
      .eq("tenant_id", tenant.id)
      .eq("channel", "whatsapp")
      .limit(2);
    if (existingError) throw existingError;
    if ((existingRows || []).length > 1) {
      return json({ error: "Ada lebih dari satu koneksi WhatsApp untuk tenant ini. Minta admin merapikan koneksi sebelum melanjutkan." }, 409);
    }

    const previous = existingRows?.[0];
    const metadata = {
      ...(previous?.metadata || {}),
      phone_number_id: phoneNumberId,
      meta_verified_name: String(metaData.verified_name || ""),
      meta_verified_phone: verifiedPhone,
      phone_id_verified_at: new Date().toISOString(),
    };
    const row = {
      tenant_id: tenant.id,
      channel: "whatsapp",
      display_name: tenant.business_name || String(metaData.verified_name || "WhatsApp Business"),
      phone: verifiedPhone,
      status: "connected",
      ai_enabled: true,
      metadata,
      updated_at: new Date().toISOString(),
    };

    let savedId: string | null = null;
    if (previous?.id) {
      const { data, error } = await db.from("jfs_channel_connections")
        .update(row).eq("id", previous.id).select("id").single();
      if (error) throw error;
      savedId = data.id;
    } else {
      const { data, error } = await db.from("jfs_channel_connections")
        .insert(row).select("id").single();
      if (error) throw error;
      savedId = data.id;
    }

    return json({
      ok: true,
      message: "Phone Number ID berhasil diverifikasi menggunakan token Meta. Pastikan webhook Meta sudah diarahkan ke whatsapp-webhook-v2 dan event messages sudah disubscribe sebelum menerima chat nyata.",
      connection: {
        id: savedId,
        phone: verifiedPhone,
        phone_number_id: phoneNumberId,
        status: "connected",
        verified_name: String(metaData.verified_name || ""),
      },
    });
  } catch (error) {
    console.error("WhatsApp connection validation failed:", error instanceof Error ? error.message : String(error));
    return json({ error: "Gagal menghubungkan WhatsApp. Periksa data tenant, akses Meta, dan log fungsi." }, 500);
  }
});
