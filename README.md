# Gold Price Manager — Complete Setup Guide

## WHAT THIS DOES
- Beautiful admin panel to update gold rates per purity (9K/14K/18K/22K/24K) daily
- Updates all Shopify product prices automatically using the formula
- Price breakup accordion on product page showing full calculation
- Checkout shows correct price (variant price is updated in Shopify directly)

## FORMULA
```
Gold Cost    = Gold Weight × Gold Rate (by purity)
Base         = Gold Cost + Diamond Value
Making       = Fixed Amount  OR  Base × Making %  (fixed takes priority if > 0)
Output       = Base + Making
Final Price  = Output + (Output × GST%)
```

## PRODUCT LOGIC
- Has purity variants (9K/14K/18K/22K/24K) → price updates per selected variant
- No variants + gold_weight filled → default 9K rate applied automatically
- No variants + gold_weight = 0 → NON GOLD product → Shopify price shown as-is

---

## PHASE 1 — SHOPIFY METAFIELD SETUP

### Shop Metafields (Settings → Custom Data → Shop)
| Key | Type |
|-----|------|
| custom.gold_rate_9k | Decimal Number |
| custom.gold_rate_14k | Decimal Number |
| custom.gold_rate_18k | Decimal Number |
| custom.gold_rate_22k | Decimal Number |
| custom.gold_rate_24k | Decimal Number |
| custom.gst_percent | Decimal Number |

### Product Metafields (Settings → Custom Data → Products)
| Key | Type | Notes |
|-----|------|-------|
| custom.gold_weight_grams | Decimal Number | Weight of gold in grams |
| custom.diamond_value | Decimal Number | Direct ₹ value. Enter 0 if no diamond. |
| custom.making_charge_fixed | Decimal Number | Fixed ₹ amount. Takes priority over percent. |
| custom.making_charge_percent | Decimal Number | % of (gold+diamond). Used if fixed = 0. |
| custom.gold_purity | Single Line Text | Only fill if NO purity variants. Leave blank = 9K default. |

### Variant Metafields (Settings → Custom Data → Variants)
| Key | Type | Notes |
|-----|------|-------|
| custom.variant_purity | Single Line Text | e.g. 9K / 14K / 18K / 22K / 24K |
| custom.variant_gold_weight | Decimal Number | Weight for this variant if different from product |

---

## PHASE 2 — SHOPIFY PRIVATE APP

1. Go to Shopify Admin → Settings → Apps → Develop Apps
2. Click "Create an App" → Name: Gold Price Manager
3. Go to Configuration → Admin API Scopes → enable:
   - read_products
   - write_products
   - read_metafields
   - write_metafields
4. Save → Install App → Reveal Admin API Token
5. Copy and save: your token + your store domain (e.g. mystore.myshopify.com)

---

## PHASE 3 — DEPLOY ON VERCEL

### Step 1 — GitHub
1. Create account at github.com
2. Create new repository: gold-price-manager (private)
3. Upload all files from this folder to the repo

### Step 2 — Vercel
1. Create account at vercel.com (free)
2. Click "Add New Project" → Import your GitHub repo
3. Framework: Next.js (auto detected)
4. Add Environment Variables (very important):
   - SHOPIFY_STORE_DOMAIN = yourstore.myshopify.com
   - SHOPIFY_ADMIN_TOKEN  = shpat_xxxxxxxxxxxx
   - ADMIN_PASSWORD       = choose any strong password
5. Click Deploy
6. Your app is live at: yourproject.vercel.app

---

## PHASE 4 — HORIZON THEME CHANGES

### Add the Snippet
1. Go to Shopify Admin → Online Store → Themes → Horizon → Edit Code
2. In snippets/ folder → Add a new snippet → Name: gold-price-breakup
3. Paste the contents of theme-snippet/gold-price-breakup.liquid

### Add to Product Page
1. Open sections/main-product.liquid
2. Find where the price is displayed (look for {{ product.price }})
3. Just below the price block, add:
   {% render 'gold-price-breakup', product: product %}
4. Save

---

## PHASE 5 — DAILY WORKFLOW

Every morning:
1. Open yourapp.vercel.app
2. Enter admin password
3. Current rates are pre-filled — update only what changed
4. Click "Save Rates" first
5. Then click "Update All Prices Now"
6. Watch the live progress log
7. Done in 30–60 seconds

All product pages, cart, and checkout will show updated prices.

---

## IMPORTANT NOTES

- Non-gold products: leave gold_weight_grams empty or 0 → they are skipped automatically
- Making charge: if BOTH fixed and percent are filled, FIXED takes priority
- Making charge is applied on Gold Cost + Diamond Value combined
- Variant weight: if a purity variant has different weight, fill variant_gold_weight on that variant
- If variant_gold_weight is blank, system uses the product level gold_weight_grams
