-- ADSPLY / Irina Cloudflare D1. Existing production DB irina-miniapp-store.
-- Safe to apply more than once. Sensitive data accessible only via private Worker.
CREATE TABLE IF NOT EXISTS store_settings (
 key TEXT PRIMARY KEY,
 value TEXT NOT NULL CHECK(json_valid(value)),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS store_products (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 provider TEXT NOT NULL DEFAULT 'adsplus',
 provider_listing_id INTEGER NOT NULL,
 slug TEXT NOT NULL,
 title TEXT NOT NULL,
 title_ru TEXT,
 title_en TEXT,
 category TEXT NOT NULL DEFAULT 'Facebook',
 category_ru TEXT,
 category_en TEXT,
 translation_attempts INTEGER NOT NULL DEFAULT 0,
 description TEXT NOT NULL DEFAULT '',
 supplier_price_cents INTEGER NOT NULL CHECK(supplier_price_cents>=0),
 stock INTEGER NOT NULL DEFAULT 0 CHECK(stock>=0),
 published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0,1)),
 last_synced_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 UNIQUE(provider,provider_listing_id)
);
CREATE INDEX IF NOT EXISTS store_products_visible ON store_products(published,stock);
CREATE TABLE IF NOT EXISTS store_orders (
 id TEXT PRIMARY KEY,
 lookup_hash TEXT NOT NULL UNIQUE,
 customer_email TEXT NOT NULL,
 product_id INTEGER NOT NULL REFERENCES store_products(id),
 product_title TEXT NOT NULL,
 quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 20),
 unit_price_cents INTEGER NOT NULL CHECK(unit_price_cents>=0),
 supplier_unit_price_cents INTEGER NOT NULL CHECK(supplier_unit_price_cents>=0),
 total_cents INTEGER NOT NULL CHECK(total_cents>=0),
 pay_network TEXT NOT NULL DEFAULT 'TRC20',
 pay_wallet TEXT NOT NULL,
 payment_tx_hash TEXT UNIQUE,
 pay_amount_micro INTEGER UNIQUE,
 ip_hash TEXT,
 status TEXT NOT NULL DEFAULT 'awaiting_payment' CHECK(status IN ('awaiting_payment','fulfilling','fulfilled','needs_review','cancelled')),
 supplier_order_id TEXT,
 delivery_ciphertext TEXT,
 purchase_started_at TEXT,
 error_message TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS store_orders_ip ON store_orders(ip_hash,created_at DESC);
CREATE INDEX IF NOT EXISTS store_orders_date ON store_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS store_orders_status ON store_orders(status);
INSERT OR IGNORE INTO store_settings(key,value) VALUES
 ('markup_pct','45'),('checkout_enabled','false'),('supplier_resale_approved','false'),
 ('usdt_trc20_wallet','""'),('sync_cursor','null'),('auto_fulfillment_enabled','false');

-- Existing deployments: ALTER TABLE store_orders ADD COLUMN pay_amount_micro INTEGER;
-- Existing deployments: ALTER TABLE store_orders ADD COLUMN purchase_started_at TEXT;
-- CREATE UNIQUE INDEX IF NOT EXISTS store_orders_payment_amount_unique ON store_orders(pay_amount_micro);

-- Existing D1: ALTER TABLE store_products ADD COLUMN title_ru TEXT;
-- Existing D1: ALTER TABLE store_products ADD COLUMN title_en TEXT;
-- Existing D1: ALTER TABLE store_products ADD COLUMN category_ru TEXT;
-- Existing D1: ALTER TABLE store_products ADD COLUMN category_en TEXT;
-- Existing D1: ALTER TABLE store_products ADD COLUMN translation_attempts INTEGER NOT NULL DEFAULT 0;
