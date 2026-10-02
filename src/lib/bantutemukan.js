export const BANTUTEMUKAN_VERTICAL = 'bantutemukan';

export const BUYER_INTENT_FIELDS = [
  'need_text', 'category', 'keywords', 'quantity', 'budget_max',
  'location', 'required_date', 'constraints', 'confidence', 'missing_fields'
];

export function createBuyerIntent(input = {}) {
  return {
    need_text: input.need_text || '',
    category: input.category || null,
    keywords: Array.isArray(input.keywords) ? input.keywords : [],
    quantity: Number.isFinite(input.quantity) ? input.quantity : null,
    budget_max: Number.isFinite(input.budget_max) ? input.budget_max : null,
    location: input.location || null,
    required_date: input.required_date || null,
    constraints: Array.isArray(input.constraints) ? input.constraints : [],
    confidence: Number.isFinite(input.confidence) ? input.confidence : 0,
    missing_fields: Array.isArray(input.missing_fields) ? input.missing_fields : []
  };
}

export function buildMatchingQuery(intent) {
  const normalized = createBuyerIntent(intent);
  return {
    vertical: BANTUTEMUKAN_VERTICAL,
    category: normalized.category,
    keywords: normalized.keywords,
    quantity: normalized.quantity,
    budget_max: normalized.budget_max,
    location: normalized.location,
    required_date: normalized.required_date,
    constraints: normalized.constraints
  };
}

export function normalizeMatches(matches = []) {
  return matches.filter(Boolean).map(match => ({
    match_id: match.match_id || match.id,
    seller_id: match.seller_id || match.tenant_id || null,
    product_id: match.product_id || null,
    name: match.name || match.product_name || '',
    price: Number.isFinite(match.price) ? match.price : null,
    availability: match.availability ?? null,
    service_area: match.service_area || match.location || null,
    match_reasons: Array.isArray(match.match_reasons) ? match.match_reasons : []
  })).filter(match => match.match_id && match.name);
}

export function createLeadPayload({ tenantId, contactId, conversationId, intent, matches = [] }) {
  return {
    vertical: BANTUTEMUKAN_VERTICAL,
    tenant_id: tenantId || null,
    contact_id: contactId || null,
    conversation_id: conversationId || null,
    intent: createBuyerIntent(intent),
    matches: normalizeMatches(matches),
    status: 'new'
  };
}
