# JFS AI WhatsApp Production Workflow

Architecture:

`WhatsApp Webhook -> Supabase -> AI -> Customer -> Order -> Automation Job -> WhatsApp`

## Edge Functions

- `whatsapp-webhook-v2`: Meta webhook verification, inbound message persistence, customer/conversation creation, product/stock context, AI response, WhatsApp reply, and order creation.
- `whatsapp-channel-connect`: JWT-protected endpoint; checks tenant owner/admin, asks Meta to validate the configured `phone_number_id`, and stores a verified connection. It does not substitute for configuring the Meta webhook callback.
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

`whatsapp-automation-worker` is intentionally protected with JWT. Production scheduling should invoke it from Supabase Cron/pg_cron using an authenticated server-side call. Do not expose the worker as an unauthenticated public endpoint.

## Orders

WhatsApp order messages create `jfs_orders` and `jfs_order_items` in the same JFS AI Platform Supabase project. This makes the order available to the main platform without a second database.

## Current limitation

The webhook handler has been hardened and deployed, but this is not yet proof of production readiness. Set `META_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, and `OPENAI_API_KEY` in Supabase Edge Function secrets; confirm the matching Meta callback and active tenant channel; and run a real inbound/outbound test. The automation worker still needs a reliable scheduled invocation with authenticated server-side credentials. Do not publish the service-role key or Meta credentials in the frontend.
