import { loadRuntimeConfig } from './config.js';

const PRODUCTS = {
  profit: '1a995492-be5d-4957-8dfb-29bb21d7f387',
  beginner: 'cfdceb95-cf9d-49d6-babc-736ade4edbc6',
};
let cached;
export function readProductPrices(html) {
  const result = {};
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1]);
      for (const product of Array.isArray(parsed) ? parsed : [parsed]) {
        const offers = Array.isArray(product?.offers) ? product.offers : [product?.offers];
        for (const offer of offers) {
          const price = offer?.priceSpecification;
          const value = Number(price?.price);
          if (!Number.isFinite(value) || value <= 0 || value > 1000000) continue;
          if (price.priceCurrency === 'USD') result.usd = value;
          if (price.priceCurrency === 'RUB') result.rub = value;
        }
      }
    } catch { /* Ignore unrelated structured data. */ }
  }
  return result.usd && result.rub ? result : null;
}
export default async function handler(req,res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow','GET');
    return res.status(405).json({ok:false});
  }
  res.setHeader('Cache-Control','public, max-age=60, s-maxage=300');
  if (cached && cached.until > Date.now()) return res.status(200).json({prices:cached.prices});
  const config = await loadRuntimeConfig();
  const prices = structuredClone(config.book.prices);
  await Promise.all(Object.entries(PRODUCTS).map(async ([book,id]) => {
    try {
      const response = await fetch('https://app.lava.top/products/'+id, {signal:AbortSignal.timeout(4000)});
      if (!response.ok) return;
      const current = readProductPrices(await response.text());
      if (current) prices[book] = current;
    } catch { /* Use the last configured provider prices during an outage. */ }
  }));
  cached = {prices,until:Date.now()+300000};
  return res.status(200).json({prices});
}
