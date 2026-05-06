import { getShopMetafields } from '../../lib/shopify';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const metas = await getShopMetafields();
    res.status(200).json({
      gold_rate_9k:   metas.gold_rate_9k?.value  || '',
      gst_percent:    metas.gst_percent?.value   || '',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
