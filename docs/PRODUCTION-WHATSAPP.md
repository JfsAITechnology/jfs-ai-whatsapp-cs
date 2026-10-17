# JFS AI WhatsApp Production Workflow

Architecture:

`WhatsApp Webhook -> Supabase -> AI -> Customer -> Order -> Automation Job -> WhatsApp`

## Edge Functions

- `whatsapp-webhook-v2`: Meta webhook verification, inbound message persistence, customer/conversation creation, product/stock context, AI response, WhatsApp reply, and order creation.
- `whatsapp-channel-connect`: JWT-protected endpoint; checks tenant owner/admin, asks Meta to validate the configured `phone_number_id`, and stores a verified connection. It does not substitute for configuring the Meta webhook callback.
- `whatsapp-ai-preview`: authenticated tenant-scoped AI test endpoint used by the dashboard; it requires a valid WhatsApp CS subscription and `OPENAI_API_KEY`.
- `whatsapp-automation-worker`: processes due `jfs_automation_jobs` and sends WhatsApp messages.

## Required secrets

Set these in Supabase Edge Function secrets before production:

- `WHATSAPP_VERIFY_TOKEN` (Meta GET verification handshake)
- `META_APP_SECRET` (required to verify `X-Hub-Signature-256` on every POST; webhook fails closed with HTTP 503 until configured)
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_GRAPH_VERSION` (for example `v23.0`)
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (for example `gpt-4o-mini`)

Supabase-provided `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are used server-side only. Never put service-role or Meta access tokens in the browser.

## WhatsApp Cloud API

Configure the Meta webhook callback to the deployed `whatsapp-webhook-v2` function URL. Subscribe the WhatsApp Business Account to the `messages` field. Use the same verify token as `WHATSAPP_VERIFY_TOKEN`. The POST handler verifies `X-Hub-Signature-256` using `META_APP_SECRET` before parsing/processing the payload; unsigned or mismatched requests are rejected. Message IDs are recorded in `jfs_whatsapp_webhook_events` and `jfs_messages` to suppress duplicate delivery.

## Channel connection

For each tenant, `jfs_channel_connections` must contain `channel='whatsapp'`, the business phone number, `status='connected'`, `ai_enabled=true`, and `metadata.phone_number_id` from Meta. The dashboard now calls `whatsapp-channel-connect`; the server verifies the ID with the Meta Graph API before saving it.

## Automation scheduler

The repository includes `.github/workflows/whatsapp-automation-scheduler.yml`, scheduled every five minutes and available for manual dispatch. The Supabase worker is deployed with JWT gateway verification disabled only because it checks a dedicated high-entropy bearer token inside the function.

Before the scheduler can run, create the same random secret named `WHATSAPP_WORKER_CRON_TOKEN` in:
1. Supabase Dashboard → Edge Functions → Secrets.
2. GitHub repository → Settings → Secrets and variables → Actions → New repository secret.

Generate a token locally in Windows PowerShell (do not share it):

```powershell
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$token = [Convert]::ToBase64String($bytes)
$rng.Dispose()
$token
```

Create a Supabase Edge Function secret named `WHATSAPP_WORKER_CRON_TOKEN` with that value, then create a GitHub Actions repository secret with the exact same name and value. Do not paste the token into source code, issues, or chat. After saving both secrets, run the scheduler workflow manually once and verify it succeeds. It also requires `WHATSAPP_ACCESS_TOKEN` in Supabase Edge Function secrets. The worker processes up to 50 due jobs per invocation; jobs missing a recipient, message body or `phone_number_id` are now marked failed with a reason instead of remaining pending forever.

## Orders

WhatsApp order messages create `jfs_orders` and `jfs_order_items` in the same JFS AI Platform Supabase project. This makes the order available to the main platform without a second database.

## Current limitation

The webhook and three supporting Edge Functions are deployed, and a protected five-minute GitHub Actions scheduler is committed. Production is still unverified until `META_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `OPENAI_API_KEY`, and the shared `WHATSAPP_WORKER_CRON_TOKEN` are configured; the Meta callback is subscribed to `messages`; a tenant channel is verified in the dashboard; and real inbound/outbound plus scheduled-job tests succeed. Do not publish the service-role key or Meta credentials in the frontend.
