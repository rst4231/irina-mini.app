import { readCheckoutIdentity } from './session.js';
import { findSendpulseContact, saveBookOrder, UUID as ORDER_UUID } from './order-tags.js';
// Server-only Lava.top integration. The client never receives the API key.
const LAVA_API = 'https://gate.lava.top';
const BOOKS = Object.freeze({
  profit: { id: '1a995492-be5d-4957-8dfb-29bb21d7f387', price: 690 },
  beginner: { id: 'cfdceb95-cf9d-49d6-babc-736ade4edbc6', price: 590 },
});
const CHECKOUT_ORIGIN = 'https://irina-miniapp.vercel.app';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,250}\.[^\s@]{2,}$/;
const cache = new Map();

function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(status).json(body);
}
function safeError(status, message, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}
async function lavaFetch(path, init = {}) {
  const key = process.env.LAVA_TOP_API_KEY;
  if (!key) throw safeError(503, 'Оплата временно не настроена.', 'not_configured');
  let response;
  try {
    response = await fetch(LAVA_API + path, {
      ...init,
      headers: {
        Accept: 'application/json',
        'X-Api-Key': key,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
      signal: AbortSignal.timeout(9000),
      cache: 'no-store',
    });
  } catch {
    throw safeError(502, 'Платёжный сервис временно недоступен. Попробуйте позже.', 'lava_unavailable');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    console.error('lava_checkout_error', { status: response.status, error: data?.error || null });
    throw safeError(502, 'Lava.top не смогла подготовить оплату. Проверьте товар или попробуйте позже.', 'lava_rejected');
  }
  return data;
}
function productArray(data) {
  const candidates = [data?.items, data?.data?.items, data?.data?.products, data?.data, data?.products, data?.result?.items, data?.result?.data, data?.result, data];
  return candidates.find(Array.isArray) || [];
}
function priceAsNumber(raw) {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') return Number(raw.replace(',','.'));
  if (raw && typeof raw === 'object') return priceAsNumber(raw.amount ?? raw.value ?? raw.price);
  return NaN;
}
function offerPrice(offer) {
  if (Array.isArray(offer?.prices)) {
    const rub = offer.prices.find(p => String(p.currency || p.currencyCode || '').toUpperCase() === 'RUB');
    if (rub) return priceAsNumber(rub.price ?? rub.amount ?? rub.value);
  }
  if (String(offer?.currency || offer?.currencyCode || '').toUpperCase() === 'RUB') {
    return priceAsNumber(offer.price ?? offer.amount);
  }
  return NaN;
}
export function selectOffer(items, book) {
  const item = items.find(p => String(p?.id || p?.productId || p?.product_id || p?.product?.id || '') === book.id);
  if (!item) return null;
  const offers = Array.isArray(item.offers) ? item.offers : Array.isArray(item.data?.offers) ? item.data.offers : [];
  const rub = offers.filter(o => UUID.test(String(o?.id || o?.offerId || '')));
  if (!rub.length) return null;
  // We never silently charge a different amount when Lava exposes the price.
  const matching = rub.find(o => offerPrice(o) === book.price);
  const unknown = rub.find(o => !Number.isFinite(offerPrice(o)));
  return matching?.id || matching?.offerId || unknown?.id || unknown?.offerId || null;
}
async function resolveOffer(book) {
  const cached = cache.get(book.id);
  if (cached && cached.expires > Date.now()) return cached.id;
  // Lava uses cursor pagination (beforeCreatedAt), not generic page/size.
  // ALL is important for hidden or API-priced products.
  let beforeCreatedAt = '';
  for (let attempt = 0; attempt < 6; attempt++) {
    const params = new URLSearchParams({ feedVisibility: 'ALL' });
    if (beforeCreatedAt) params.set('beforeCreatedAt', beforeCreatedAt);
    const payload = await lavaFetch('/api/v2/products?' + params.toString());
    const products = productArray(payload);
    const offer = selectOffer(products, book);
    if (offer) {
      cache.set(book.id, { id: offer, expires: Date.now() + 10 * 60_000 });
      return offer;
    }
    if (!products.length) break;
    const last = products.at(-1);
    const nextCursor = String(last?.createdAt || last?.created_at || '');
    if (!nextCursor || nextCursor === beforeCreatedAt || products.length < 10) break;
    beforeCreatedAt = nextCursor;
  }
  throw safeError(503, 'Не удалось найти предложение для книги в Lava.top. Проверьте цену и доступность товара.', 'offer_not_found');
}
function trustedInvoiceUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && (host === 'lava.top' || host.endsWith('.lava.top')) ? url.href : null;
  } catch { return null; }
}
export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return send(res, 405, { ok: false, error: 'method_not_allowed' });
  }
  if (req.method === 'POST') {
    const origin = req.headers.origin;
    if (origin && origin !== CHECKOUT_ORIGIN) return send(res, 403, { ok:false, error:'invalid_origin' });
    const length = Number(req.headers['content-length'] || 0);
    if (length > 1024) return send(res, 413, { ok:false, error:'too_large' });
  }
  const bookKey = req.method === 'GET' ? String(req.query?.book || '') : String(req.body?.book || '');
  const book = BOOKS[bookKey];
  if (!book) return send(res, 400, { ok:false, error:'unknown_book' });
  if (req.method === 'POST' && (!EMAIL.test(String(req.body?.email || '')) || String(req.body?.email || '').length > 320)) {
    return send(res, 400, { ok:false, error:'invalid_email', message:'Введите корректный e-mail для получения книги.' });
  }
  // Telegram signature was validated at /api/lava/session.
  // Only an HMAC-protected HttpOnly cookie can identify the buyer.
  const telegramId = req.method === 'POST'
    ? readCheckoutIdentity(req.headers.cookie || '', process.env.TELEGRAM_BOT_TOKEN)
    : null;
  if (req.method === 'POST' && !telegramId) {
    return send(res, 401, { ok:false, error:'telegram_auth_required',
      message:'Откройте страницу через мини-приложение @rstshelp_bot, чтобы покупка привязалась к вашему Telegram.' });
  }
  try {
    const contact = telegramId ? await findSendpulseContact(telegramId) : null;
    const offerId = await resolveOffer(book);
    if (req.method === 'GET') return send(res, 200, { ok:true, ready:true, book:bookKey });
    const bookParam = encodeURIComponent(bookKey);
    const redirect = CHECKOUT_ORIGIN + '/book?book=' + bookParam;
    const payload = await lavaFetch('/api/v3/invoice', {
      method: 'POST',
      body: JSON.stringify({
        email: String(req.body.email).trim().toLowerCase(),
        offerId, currency: 'RUB',
        successful_return_url: redirect,
        failure_return_url: redirect,
        cancel_return_url: redirect,
      }),
    });
    const invoice = payload?.data?.invoice ?? payload?.data ?? payload?.result ?? payload;
    const invoiceUrl = invoice?.paymentUrl ?? invoice?.payment_url ?? invoice?.url ?? payload?.paymentUrl;
    const paymentUrl = trustedInvoiceUrl(invoiceUrl);
    if (!paymentUrl) throw safeError(502, 'Lava.top не вернула ссылку на оплату.', 'payment_url_missing');
    const invoiceId = String(invoice?.id ?? invoice?.invoiceId ?? invoice?.contractId ?? payload?.invoiceId ?? '');
    if (!ORDER_UUID.test(invoiceId)) throw safeError(502, 'Lava.top не вернула номер счёта.', 'invoice_id_missing');
    // Persist before exposing the checkout URL so webhook can identify buyer.
    await saveBookOrder({
      invoiceId, bookKey, telegramId, contactId: contact.id,
      offerId, email: req.body.email,
    });
    return send(res, 200, { ok:true, paymentUrl, invoiceId });
  } catch (error) {
    return send(res, error?.status || 502, { ok:false, error:error?.code || 'checkout_unavailable', message:error?.message || 'Не удалось подготовить платёж.' });
  }
}
