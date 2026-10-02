-- Bantutemukan integration primitives for JFS AI WhatsApp CS.
-- Apply only after the target production JFS AI Platform schema is verified.
-- This does NOT modify the inactive Bantutemukan Supabase project.

create table if not exists public.jfs_marketplace_leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  contact_id uuid references public.jfs_contacts(id) on delete set null,
  conversation_id uuid references public.jfs_conversations(id) on delete set null,
  vertical text not null default 'bantutemukan',
  need_text text not null,
  intent jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new','matched','customer_confirmed','seller_notified','accepted','completed','rejected','cancelled','expired')),
  selected_match_id uuid,
  source text not null default 'whatsapp',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jfs_marketplace_matches (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.jfs_marketplace_leads(id) on delete cascade,
  seller_id uuid,
  product_id uuid,
  name text not null,
  price numeric(14,2),
  availability jsonb,
  service_area text,
  match_reasons jsonb not null default '[]'::jsonb,
  rank integer,
  created_at timestamptz not null default now()
);

alter table public.jfs_marketplace_leads enable row level security;
alter table public.jfs_marketplace_matches enable row level security;

create index if not exists jfs_marketplace_leads_tenant_created_idx on public.jfs_marketplace_leads(tenant_id, created_at desc);
create index if not exists jfs_marketplace_matches_lead_rank_idx on public.jfs_marketplace_matches(lead_id, rank);

create policy jfs_marketplace_leads_tenant_manage on public.jfs_marketplace_leads for all to authenticated using (public.jfs_user_can_manage_tenant(tenant_id)) with check (public.jfs_user_can_manage_tenant(tenant_id));

create policy jfs_marketplace_matches_tenant_manage on public.jfs_marketplace_matches for all to authenticated using (exists (select 1 from public.jfs_marketplace_leads l where l.id = lead_id and public.jfs_user_can_manage_tenant(l.tenant_id))) with check (exists (select 1 from public.jfs_marketplace_leads l where l.id = lead_id and public.jfs_user_can_manage_tenant(l.tenant_id)));
