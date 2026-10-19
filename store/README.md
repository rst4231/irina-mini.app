# LH STORE — Meta account storefront inside Irina

## Components
- `/store` storefront; `/store/admin` authenticated admin; `/store/order` private receipt.
- `/api/store/*`: Vercel backend, secrets stay server-side.
- `cloudflare/irina-store-d1-worker.js`: private D1 Worker (D1 binding `STORE_DB`) called with a long bearer token; no public database access.
- Database `irina-miniapp-store` is separate from the rest of Irina; no homepage link.

## Before enabling checkout (required, production)

1. Create Cloudflare Worker with `STORE_DB` D1 binding and secret `STORE_D1_TOKEN`, and configure HTTPS URL (`/internal`) and the identical token in the Vercel project as `STORE_D1_URL` and `STORE_D1_TOKEN`.
2. Set `STORE_ADSPLUS_API_KEY` as an encrypted Vercel environment secret. Account catalog ONLY uses ADSPLUS `/en/accounts/api/v3/*` (not SMM, OTP or proxies). Confirm sourcing and resale permissions before manually publishing individual SKUs. Personal Meta account transfers may breach Meta terms.
3. Set `STORE_ADMIN_TOKEN` (32+ random characters), and `STORE_DELIVERY_ENCRYPTION_KEY` (32 random bytes in hex). Never log delivery credentials or expose keys client-side.
4. Set `STORE_TRONSCAN_API_KEY` to use TRONSCAN's transaction-info API, and `STORE_PAYMENT_CONFIRMATION_MODE=tronscan`. Verify the API has access to network mainnet and stable quotas.
5. Admin config: add YOUR valid USDT TRC20 wallet, confirm reseller permission, review only appropriate Meta inventory, enable checkout. To permit automatic buying after on-chain verification ALSO set `STORE_ALLOW_AUTOFULFILL=true` on the server, then set `auto_fulfillment_enabled` in admin. These flags intentionally default to false.

## Automatic Russian and English catalog localization

- D1 stores the supplier's original Thai title/category plus title_ru, title_en, category_ru and category_en.
- Cloudflare Worker irina-store-d1 now binds Workers AI as AI and has a cron job every five minutes to translate new or modified supplier items using @cf/meta/m2m100-1.2b (THB products only; no wallet keys).
- Existing translations are preserved when supplier stock/price changes. They are invalidated only when original title or category changes. The translator retries failed translations at most three times.
- Manually checked initial products (16 rows) already have RU/EN labels in D1. Untranslated products remain hidden from the storefront until both languages are populated.
- Cloudflare Workers AI inference has usage costs and quotas; monitor Cloudflare Workers AI metrics and review questionable machine translations before publishing SKUs.
- The storefront shows Russian titles on RU and English titles on EN. Receipt titles use the language of purchase; original supplier account credentials are not altered.

## Payment flow
- ADSPLUS charges THB. Frankfurter v2 (`/v2/rate/thb/usd`) provides daily THB/USD with a 3% FX safety buffer; quotes are USD/USDT cents. Expired or unavailable rates fail closed.
- Each order has a unique 6-decimal USDT amount. Receipt has TXID input; backend confirms transaction hash, 20 confirmations, success, exact official USDT TRC20 contract, correct wallet and exact amount, and transfer time within 24 hours after invoice; TXID is one-use only.
- The customer invokes verification by providing TXID. This is NOT autonomous address monitoring. To implement polling/on-chain webhook later, add a verified provider integration and clear retry semantics.
- Only after verified payment is the order marked `fulfilling` atomically in D1. If enabled, backend attempts buying from ADSPLUS once. Supplier has no documented idempotency key for account purchases; durable `purchase_started_at` prevents a retry. Ambiguous vendor outcomes require manual reconciliation via ADSPLUS order history before manual delivery/refund.
- Seller balance at ADSPLUS must be funded separately from buyer USDT payments; no direct card processing or crypto custody is implemented.
- The original AccsZone/Supabase implementation is superseded, but retained SQL history isn't used by the new backend.

## Test
`node --test tests/store-*.test.mjs`. Existing Irina tests: `npm test` from repository root.

## Security
- Never use private wallet keys in this app. No signing of chain transactions. Each receipt URL contains a private random lookup token. Use a fresh ADSPLUS API key after rotating any key previously shared in chat.
- Keep checkout and auto-fulfilment disabled until realistic end-to-end payment tests, concurrency tests, stock checks, legal terms and refunds/reconciliation are verified.
