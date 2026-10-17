import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";
const graph = Deno.env.get("WHATSAPP_GRAPH_VERSION") || "v23.0";
const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { "content-type": "application/json" } });
async function send(phoneId: string, to: string, text: string) {
  if (!token) throw new Error("WHATSAPP_ACCESS_TOKEN missing");
  const r = await fetch(`https://graph.facebook.com/${graph}/${phoneId}/messages`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }) });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(JSON.stringify(b));
}
Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!token) return json({ error: "WHATSAPP_ACCESS_TOKEN is not configured" }, 503);
  try {
    const { data: jobs, error } = await db.from("jfs_automation_jobs").select("id,tenant_id,contact_id,channel,payload,attempts").eq("channel", "whatsapp").eq("status", "pending").lte("scheduled_at", new Date().toISOString()).order("scheduled_at", { ascending: true }).limit(50);
    if (error) throw error;
    let sent = 0, waiting = 0, failed = 0;
    for (const j of jobs || []) {
      const p = j.payload || {};
      const to = String(p.to || "").trim();
      const phoneId = String(p.phone_number_id || "").trim();
      const message = String(p.message || "").trim();
      const missing = [
        !to && "recipient phone",
        !phoneId && "phone_number_id",
        !message && "message body",
      ].filter(Boolean);
      if (missing.length) {
        const reason = "Automation job cannot be sent; missing " + missing.join(", ");
        const { error: invalidJobError } = await db.from("jfs_automation_jobs")
          .update({
            status: "failed",
            attempts: (j.attempts || 0) + 1,
            last_error: reason,
            updated_at: new Date().toISOString(),
          })
          .eq("id", j.id)
          .eq("status", "pending");
        if (invalidJobError) throw invalidJobError;
        failed++;
        continue;
      }
      const claim = await db.from("jfs_automation_jobs").update({ status: "processing", attempts: (j.attempts || 0) + 1, updated_at: new Date().toISOString() }).eq("id", j.id).eq("status", "pending").select("id").maybeSingle();
      if (claim.error) throw claim.error;
      if (!claim.data) continue;
      try {
        await send(phoneId, to, message);
        const { error: sentUpdateError } = await db.from("jfs_automation_jobs")
          .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() })
          .eq("id", j.id).eq("status", "processing");
        if (sentUpdateError) throw sentUpdateError;
        sent++;
      } catch (e) {
        const { error: failedUpdateError } = await db.from("jfs_automation_jobs")
          .update({ status: "failed", last_error: String(e).slice(0, 1000), updated_at: new Date().toISOString() })
          .eq("id", j.id).eq("status", "processing");
        if (failedUpdateError) console.error("Could not mark automation job failed:", failedUpdateError.message);
        failed++;
      }
    }
    return json({ ok: true, processed: (jobs || []).length, sent, waiting, failed });
  } catch (e) { console.error(e); return json({ error: String(e) }, 500); }
});
