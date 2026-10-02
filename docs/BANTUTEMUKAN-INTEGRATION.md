# Bantutemukan.id + JFS AI WhatsApp CS

Bantutemukan.id is a marketplace/search vertical on top of JFS AI WhatsApp CS. It uses one shared WhatsApp AI layer while keeping Bantutemukan-specific buyer intent and matching rules isolated.

## Core flow

Buyer WhatsApp -> intent extraction -> Bantutemukan matching -> matched UMKM/products -> buyer confirmation -> lead/order -> UMKM WhatsApp -> follow-up automation.

## Buyer intent contract

The AI should extract only information supported by the customer message:
- need_text: original need in concise form
- category: requested product/service category
- keywords: search terms
- quantity: requested quantity when stated
- budget_max: maximum budget when stated
- location: requested delivery/service area when stated
- required_date: requested date/deadline when stated
- constraints: explicit dietary, size, brand, service, or other constraints
- confidence: 0..1
- missing_fields: fields that materially block matching

Do not invent missing values.

## Matching contract

The matching layer must query real Bantutemukan/JFS marketplace data only. It returns match_id, seller/UMKM id, product/service id, name, price, availability, service area, and match_reasons.

The AI may summarize matches, but must not create sellers, products, prices, stock, availability, or ratings that are not present in the database.

## Lead lifecycle

new -> matched -> customer_confirmed -> seller_notified -> accepted -> completed

Terminal alternatives: rejected, cancelled, expired.

A lead is not an order until the business flow explicitly confirms it as an order.

## Responsibilities

JFS AI WhatsApp CS owns inbound/outbound WhatsApp, contacts, conversations, AI conversation, automation jobs, and tenant/channel isolation.

Bantutemukan owns buyer requirements, marketplace search/matching, UMKM/product records, and match/lead state.

JFS AI Platform owns shared tenant/account/order infrastructure where applicable.

## First integration boundary

The first production implementation should expose a server-side matching service/tool to whatsapp-webhook-v2. The browser must never receive Meta access tokens, AI keys, or Supabase service-role keys.

## Database principle

Do not merge the currently inactive Bantutemukan Supabase project into production blindly. First inspect and reconcile its schema when the project is reachable. Until then, this repository defines the integration contract, not a destructive migration.

## Example

Customer: Saya butuh nasi box 50 orang besok di Wonocolo, maksimal 30 ribu per box.

Extracted intent: category=catering/nasi box, quantity=50, budget_max=30000, location=Wonocolo, required_date=tomorrow.

The matching service searches real inventory and returns matching UMKM options. The AI asks the customer to choose or asks only for missing information needed to continue.
