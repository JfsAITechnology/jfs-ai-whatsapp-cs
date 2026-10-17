-- Idempotency and internal webhook event ledger for Meta WhatsApp deliveries.
ALTER TABLE public.jfs_messages
  ADD COLUMN IF NOT EXISTS provider_message_id text;

CREATE UNIQUE INDEX IF NOT EXISTS jfs_messages_provider_message_uidx
  ON public.jfs_messages (tenant_id, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS jfs_orders_whatsapp_external_id_uidx
  ON public.jfs_orders (tenant_id, external_id)
  WHERE source = 'whatsapp' AND external_id IS NOT NULL;

ALTER TABLE public.jfs_automation_jobs
  ADD COLUMN IF NOT EXISTS source_event_id text;

CREATE UNIQUE INDEX IF NOT EXISTS jfs_automation_jobs_source_event_uidx
  ON public.jfs_automation_jobs (tenant_id, source_event_id, automation_id)
  WHERE source_event_id IS NOT NULL AND automation_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS jfs_conversations_one_open_whatsapp_uidx
  ON public.jfs_conversations (tenant_id, contact_id, channel)
  WHERE channel = 'whatsapp' AND status = 'open';

CREATE TABLE IF NOT EXISTS public.jfs_whatsapp_webhook_events (
  message_id text PRIMARY KEY,
  tenant_id uuid NULL REFERENCES public.tenants(id) ON DELETE SET NULL,
  phone_number_id text NOT NULL,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'processed', 'ignored', 'failed')),
  attempts integer NOT NULL DEFAULT 1 CHECK (attempts >= 1),
  last_error text NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS jfs_whatsapp_webhook_events_status_updated_idx
  ON public.jfs_whatsapp_webhook_events (status, updated_at);

ALTER TABLE public.jfs_whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.jfs_whatsapp_webhook_events FROM anon, authenticated;
GRANT ALL ON TABLE public.jfs_whatsapp_webhook_events TO service_role;
