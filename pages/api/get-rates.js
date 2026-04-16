import { getShopMetafields } from '../../lib/shopify';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const metas = await getShopMetafields();
    res.status(200).json({
      gold_rate_9k:   metas.gold_rate_9k?.value  || '',
      gold_rate_14k:  metas.gold_rate_14k?.value || '',
      gold_rate_18k:  metas.gold_rate_18k?.value || '',
      gold_rate_22k:  metas.gold_rate_22k?.value || '',
      gold_rate_24k:  metas.gold_rate_24k?.value || '',
      gst_percent:    metas.gst_percent?.value   || '',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
