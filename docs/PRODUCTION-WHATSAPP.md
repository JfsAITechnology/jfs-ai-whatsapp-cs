# JFS AI WhatsApp Production Workflow

Architecture:

`WhatsApp Webhook -> Supabase -> AI -> Customer -> Order -> Automation Job -> WhatsApp`

## Edge Functions

- `whatsapp-webhook-v2`: Meta webhook verification, inbound message persistence, customer/conversation creation, product/stock context, AI response, WhatsApp reply, and order creation.
- `whatsapp-automation-worker`: processes due `jfs_automation_jobs` and sends WhatsApp messages.

## Required secrets

Set these in Supabase Edge Function secrets before production:

- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_GRAPH_VERSION` (for example `v23.0`)
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (for example `gpt-4o-mini`)

Supabase-provided `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are used server-side only. Never put service-role or Meta access tokens in the browser.

## WhatsApp Cloud API

Configure the Meta webhook callback to the deployed `whatsapp-webhook-v2` function URL. Subscribe the WhatsApp Business Account to the `messages` field. Use the same verify token as the Edge Function secret.

## Channel connection

For each tenant, `jfs_channel_connections` must contain `channel='whatsapp'`, the business phone number, `ai_enabled=true`, and `metadata.phone_number_id` from Meta.

## Automation scheduler

`whatsapp-automation-worker` is intentionally protected with JWT. Production scheduling should invoke it from Supabase Cron/pg_cron using an authenticated server-side call. Do not expose the worker as an unauthenticated public endpoint.

## Orders

WhatsApp order messages create `jfs_orders` and `jfs_order_items` in the same JFS AI Platform Supabase project. This makes the order available to the main platform without a second database.

## Current limitation

The code and database foundation are deployed, but production Meta/OpenAI secrets and Meta webhook configuration are account-level credentials that cannot be safely fabricated. They must be entered in the Supabase/Meta dashboards before real WhatsApp traffic can flow.
