import { setShopMetafield } from '../../lib/shopify';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const password = req.headers['x-admin-password'];
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { gold_rate_9k, gold_rate_14k, gold_rate_18k, gold_rate_22k, gold_rate_24k, gst_percent } = req.body;

  try {
    await Promise.all([
      setShopMetafield('gold_rate_9k',  gold_rate_9k),
      setShopMetafield('gold_rate_14k', gold_rate_14k),
      setShopMetafield('gold_rate_18k', gold_rate_18k),
      setShopMetafield('gold_rate_22k', gold_rate_22k),
      setShopMetafield('gold_rate_24k', gold_rate_24k),
      setShopMetafield('gst_percent',   gst_percent),
    ]);
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
