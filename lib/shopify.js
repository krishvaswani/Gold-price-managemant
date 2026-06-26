const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_TOKEN  = process.env.SHOPIFY_ADMIN_TOKEN;

const BASE_URL = `https://${SHOPIFY_DOMAIN}/admin/api/2026-01`;

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

export async function getAllProductsWithMetafields() {
  const products = [];
  let hasNextPage = true;
  let cursor = null;
  
  const GRAPHQL_URL = `https://${SHOPIFY_DOMAIN}/admin/api/2026-01/graphql.json`;
  
  const query = `
    query getProducts($cursor: String) {
      products(first: 250, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            title
            variants(first: 100) {
              edges {
                node {
                  id
                  price
                }
              }
            }
            metafields(first: 20, namespace: "custom") {
              edges {
                node {
                  key
                  value
                }
              }
            }
          }
        }
      }
    }
  `;

  while (hasNextPage) {
    const res = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': SHOPIFY_TOKEN,
      },
      body: JSON.stringify({
        query,
        variables: { cursor }
      })
    });

    if (res.status === 429) {
      const retryAfter = parseFloat(res.headers.get('Retry-After')) || 2;
      console.warn(`[Shopify API] GraphQL 429 rate limit. Retrying in ${retryAfter}s...`);
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Shopify GraphQL error: ${res.status} ${res.statusText} - ${text}`);
    }

    const json = await res.json();
    if (json.errors) {
      throw new Error(`Shopify GraphQL query error: ${JSON.stringify(json.errors)}`);
    }

    const connection = json.data?.products;
    if (!connection) break;

    for (const edge of connection.edges || []) {
      const node = edge.node;
      
      const metafields = {};
      for (const mEdge of node.metafields?.edges || []) {
        metafields[mEdge.node.key] = mEdge.node.value;
      }

      const variants = (node.variants?.edges || []).map(vEdge => ({
        id: vEdge.node.id.split('/').pop(),
        price: vEdge.node.price,
      }));

      products.push({
        id: node.id.split('/').pop(),
        title: node.title,
        variants,
        metafields,
      });
    }

    hasNextPage = connection.pageInfo.hasNextPage;
    cursor = connection.pageInfo.endCursor;
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
  const maxRetries = 5;
  let attempt = 0;
  while (attempt < maxRetries) {
    const res = await fetch(`${BASE_URL}/variants/${variantId}.json`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ variant: { id: variantId, price: price.toFixed(2) } }),
    });

    if (res.status === 429) {
      const retryAfter = parseFloat(res.headers.get('Retry-After')) || 2;
      console.warn(`[Shopify API] 429 Too Many Requests on variant ${variantId}. Retrying in ${retryAfter}s...`);
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      attempt++;
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to update variant ${variantId}: ${res.status} ${res.statusText} - ${text}`);
    }
    return;
  }
  throw new Error(`Failed to update variant ${variantId} after ${maxRetries} attempts due to rate limits.`);
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

export function calculatePrice({ goldWeight, goldRate, diamondValue, makingFixed, stonePrice, gstPercent }) {
  const tgp         = goldWeight * goldRate;
  const makingCharge = makingFixed * goldWeight;
  const tgpm        = tgp + makingCharge;
  const stoneVal    = stonePrice || 0;
  const output      = tgpm + diamondValue + stoneVal;
  const finalPrice  = output + (output * gstPercent / 100);
  return {
    goldCost:    Math.round(tgp),
    makingCharge: Math.round(makingCharge),
    diamondValue: Math.round(diamondValue),
    stonePrice:  Math.round(stoneVal),
    output:      Math.round(output),
    gstAmount:   Math.round(output * gstPercent / 100),
    finalPrice:  Math.round(finalPrice),
  };
}
