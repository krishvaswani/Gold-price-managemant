const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_TOKEN  = process.env.SHOPIFY_ADMIN_TOKEN;

const BASE_URL = `https://${SHOPIFY_DOMAIN}/admin/api/2024-01`;

const headers = {
  'Content-Type': 'application/json',
  'X-Shopify-Access-Token': SHOPIFY_TOKEN,
};

// ─── Metafields ───────────────────────────────────────────────────────────────

export async function getShopMetafields() {
  const res  = await fetch(`${BASE_URL}/metafields.json?namespace=custom`, { headers });
  const data = await res.json();
  const map  = {};
  (data.metafields || []).forEach(m => { map[m.key] = { id: m.id, value: m.value }; });
  return map;
}

export async function setShopMetafield(key, value, type = 'number_decimal') {
  // Try update first, then create
  const existing = await getShopMetafieldByKey(key);
  if (existing) {
    await fetch(`${BASE_URL}/metafields/${existing.id}.json`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ metafield: { id: existing.id, value: String(value), type } }),
    });
  } else {
    await fetch(`${BASE_URL}/metafields.json`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ metafield: { namespace: 'custom', key, value: String(value), type } }),
    });
  }
}

async function getShopMetafieldByKey(key) {
  const res  = await fetch(`${BASE_URL}/metafields.json?namespace=custom&key=${key}`, { headers });
  const data = await res.json();
  return data.metafields?.[0] || null;
}

// ─── Products ─────────────────────────────────────────────────────────────────

export async function getAllProducts() {
  let products = [];
  let url      = `${BASE_URL}/products.json?limit=250&fields=id,title,variants`;

  while (url) {
    const res  = await fetch(url, { headers });
    const data = await res.json();
    products   = products.concat(data.products || []);

    const link = res.headers.get('Link') || '';
    const next = link.match(/<([^>]+)>;\s*rel="next"/);
    url        = next ? next[1] : null;
  }
  return products;
}

export async function getProductMetafields(productId) {
  const res  = await fetch(`${BASE_URL}/products/${productId}/metafields.json?namespace=custom`, { headers });
  const data = await res.json();
  const map  = {};
  (data.metafields || []).forEach(m => { map[m.key] = m.value; });
  return map;
}

export async function getVariantMetafields(variantId) {
  const res  = await fetch(`${BASE_URL}/variants/${variantId}/metafields.json?namespace=custom`, { headers });
  const data = await res.json();
  const map  = {};
  (data.metafields || []).forEach(m => { map[m.key] = m.value; });
  return map;
}

export async function updateVariantPrice(variantId, price) {
  await fetch(`${BASE_URL}/variants/${variantId}.json`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ variant: { id: variantId, price: price.toFixed(2) } }),
  });
}

// ─── Purity helpers ───────────────────────────────────────────────────────────

export const PURITY_KEYS = ['9k', '14k', '18k', '22k', '24k'];

export const PURITY_LABEL_MAP = {
  '9K':  'gold_rate_9k',
  '14K': 'gold_rate_14k',
  '18K': 'gold_rate_18k',
  '22K': 'gold_rate_22k',
  '24K': 'gold_rate_24k',
};

// ─── Price formula ────────────────────────────────────────────────────────────

export function calculatePrice({ goldWeight, goldRate, diamondValue, makingFixed, makingPercent, gstPercent }) {
  const goldCost    = goldWeight * goldRate;
  const base        = goldCost + diamondValue;
  const making      = makingFixed > 0 ? makingFixed : (base * makingPercent / 100);
  const output      = base + making;
  const finalPrice  = output + (output * gstPercent / 100);
  return {
    goldCost:    Math.round(goldCost),
    diamondValue: Math.round(diamondValue),
    making:      Math.round(making),
    output:      Math.round(output),
    gstAmount:   Math.round(output * gstPercent / 100),
    finalPrice:  Math.round(finalPrice),
  };
}
