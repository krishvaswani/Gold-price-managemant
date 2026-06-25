import {
  getAllProductsWithMetafields,
  getShopMetafields,
  updateVariantPrice,
  calculatePrice,
} from '../../lib/shopify';

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

    const goldRate = parseFloat(shopMetas.gold_rate_9k?.value) || 0;
    const gstPercent = parseFloat(shopMetas.gst_percent?.value) || 0;

    if (!goldRate) {
      send({ type: 'error', message: 'Gold rate 9K not set. Please set it first.' });
      res.end();
      return;
    }

    // 2. Get all products with metafields
    send({ type: 'status', message: 'Fetching all products and metafields...' });
    const products = await getAllProductsWithMetafields();
    send({ type: 'total', count: products.length });

    let updated = 0;
    let skipped = 0;

    for (const product of products) {
      try {
        const productMetas = product.metafields || {};

        const goldWeight    = parseFloat(productMetas.gold_weight_grams)      || 0;
        const diamondValue  = parseFloat(productMetas.diamond_value)           || 0;
        const makingFixed   = parseFloat(productMetas.making_charge_fixed)     || 0;
        const stonePrice    = parseFloat(productMetas.stone_price)             || 0;

        if (!goldWeight) {
          send({ type: 'product', name: product.title, status: 'skipped', reason: 'No gold weight specified' });
          skipped++;
          continue;
        }

        const result = calculatePrice({
          goldWeight,
          goldRate,
          diamondValue,
          makingFixed,
          stonePrice,
          gstPercent,
        });

        // Update all variants in parallel, utilizing the robust 429 auto-retry wrapper
        if (product.variants && product.variants.length > 0) {
          await Promise.all(
            product.variants.map(variant => updateVariantPrice(variant.id, result.finalPrice))
          );
        }

        send({ type: 'product', name: product.title, status: 'updated' });
        updated++;

        // Small delay to pace requests
        await new Promise(r => setTimeout(r, 100));

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
