import {
  getAllProducts,
  getProductMetafields,
  getVariantMetafields,
  getShopMetafields,
  updateVariantPrice,
  calculatePrice,
  PURITY_LABEL_MAP,
} from '../../lib/shopify';

// Purity variant title detection
const PURITY_TITLES = ['9K', '14K', '18K', '22K', '24K'];

function isPurityVariant(title) {
  return PURITY_TITLES.includes(title?.trim().toUpperCase());
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const password = req.headers['x-admin-password'];
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Set up streaming response so frontend can show live progress
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    // 1. Load current shop rates
    send({ type: 'status', message: 'Loading current gold rates...' });
    const shopMetas = await getShopMetafields();

    const rates = {
      '9K':  parseFloat(shopMetas.gold_rate_9k?.value)  || 0,
      '14K': parseFloat(shopMetas.gold_rate_14k?.value) || 0,
      '18K': parseFloat(shopMetas.gold_rate_18k?.value) || 0,
      '22K': parseFloat(shopMetas.gold_rate_22k?.value) || 0,
      '24K': parseFloat(shopMetas.gold_rate_24k?.value) || 0,
    };
    const gstPercent = parseFloat(shopMetas.gst_percent?.value) || 0;

    // 2. Get all products
    send({ type: 'status', message: 'Fetching all products...' });
    const products = await getAllProducts();
    send({ type: 'total', count: products.length });

    let updated = 0;
    let skipped = 0;

    for (const product of products) {
      try {
        const productMetas = await getProductMetafields(product.id);

        const goldWeight    = parseFloat(productMetas.gold_weight_grams)      || 0;
        const diamondValue  = parseFloat(productMetas.diamond_value)           || 0;
        const makingFixed   = parseFloat(productMetas.making_charge_fixed)     || 0;
        const makingPercent = parseFloat(productMetas.making_charge_percent)   || 0;
        const productPurity = productMetas.gold_purity?.trim().toUpperCase()   || null;

        // CASE 3 — Non gold product: gold weight empty/0 and no purity variants
        const hasPurityVariants = product.variants.some(v => isPurityVariant(v.title));
        const isNonGold = !goldWeight && !hasPurityVariants;

        if (isNonGold) {
          send({ type: 'product', name: product.title, status: 'skipped', reason: 'Non-gold product' });
          skipped++;
          continue;
        }

        for (const variant of product.variants) {
          let purity     = '9K'; // default
          let weight     = goldWeight;

          // CASE 1 — Purity variant
          if (isPurityVariant(variant.title)) {
            const varMetas = await getVariantMetafields(variant.id);
            purity = (varMetas.variant_purity || variant.title).trim().toUpperCase();
            weight = parseFloat(varMetas.variant_gold_weight) || goldWeight;
          }
          // CASE 2 — No purity variants, use product purity or default 9K
          else if (productPurity && rates[productPurity]) {
            purity = productPurity;
          }

          const goldRate = rates[purity] || rates['9K'];

          if (!goldRate) {
            send({ type: 'warn', name: product.title, message: `Rate not set for ${purity}` });
            continue;
          }

          const result = calculatePrice({
            goldWeight: weight,
            goldRate,
            diamondValue,
            makingFixed,
            makingPercent,
            gstPercent,
          });

          await updateVariantPrice(variant.id, result.finalPrice);
        }

        send({ type: 'product', name: product.title, status: 'updated' });
        updated++;

        // Small delay to avoid Shopify rate limits
        await new Promise(r => setTimeout(r, 300));

      } catch (err) {
        send({ type: 'product', name: product.title, status: 'error', reason: err.message });
      }
    }

    send({ type: 'done', updated, skipped });
    res.end();

  } catch (err) {
    send({ type: 'error', message: err.message });
    res.end();
  }
}
