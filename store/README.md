# ADSPLY within Irina Mini App

**Only new files** have been added. Nothing in the Irina homepage, book pages, their APIs, or `vercel.json` has been edited. Vercel `cleanUrls: true` already serves `/store` from `store.html`, and `/store/admin` and `/store/order` from their `.html` counterparts, as it does `/book`.

- `/store`: RU/EN digital products storefront, with light/dark themes. No link on the main Irina page.
- `/store/admin`: private admin token form; all admin API routes require the token.
- `/store/order`: order status via private receipt URL.
- `/api/store/*`: isolated catalog/order/admin APIs.
- `/lib/store/*`: isolated supplier/database/cryptography.

**Demo mode** until database and vendor rights are configured. Checkout off by default.

## Before real sales

1. Create separate Supabase project, run `store/schema.sql`; set `STORE_SUPABASE_URL`, `STORE_SUPABASE_SERVICE_ROLE_KEY` in the existing **Irina Vercel project**. Do not reuse Irina business API credentials.
2. Obtain supplier reseller permission and API key; set `STORE_ACCSZONE_API_KEY`. Account transfers that violate Meta rules must not be sold.
3. Set a high-entropy `STORE_ADMIN_TOKEN` and `STORE_DELIVERY_ENCRYPTION_KEY` (64 hex digits, 32 bytes).
4. Carefully inspect and manually publish only eligible items through `/store/admin`.
5. Set USDT TRC20 wallet and manually verify payments on-chain before fulfillment. Until legal rights, payment, and DB are validated leave checkout disabled.

No automatic paid orders, resale rights, or provider connection are included in this patch.
