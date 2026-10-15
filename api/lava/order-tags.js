import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const SENDPULSE_BASE = 'https://api.sendpulse.com/telegram';
const SENDPULSE_BOT_ID = '6671465ac84ab24b4702fa25';
export const TAG_BY_BOOK = Object.freeze({ profit: 'Купил книгу 1', beginner: 'Купил книгу 2' });
export const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function fail(error, status = 502) { const e = new Error(error); e.status = status; return e; }
export function emailDigest(email) {
  return crypto.createHash('sha256').update(String(email).trim().toLowerCase()).digest('hex');
}
function sql() {
  const url = process.env.BOOK_ORDERS_DATABASE_URL;
  if (!url) throw fail('Хранилище платежей не настроено', 503);
  return neon(url);
}
async function spFetch(path, options) {
  if (!process.env.SENDPULSE_API_KEY) throw fail('SendPulse не настроен', 503);
  const response = await fetch(SENDPULSE_BASE + path, {
    ...options,
    headers: {
      Authorization: 'Bearer ' + process.env.SENDPULSE_API_KEY,
      Accept: 'application/json',
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
    },
    signal: AbortSignal.timeout(3800),
    cache: 'no-store',
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result?.success === false) throw fail('SendPulse недоступен: ' + response.status);
  return result?.data && !Array.isArray(result.data) ? result.data : result;
}
export async function findSendpulseContact(telegramId) {
  const params = new URLSearchParams({ bot_id: SENDPULSE_BOT_ID, telegram_id: String(telegramId) });
  const data = await spFetch('/contacts/getByTelegramId?' + params.toString());
  const id = String(data?.id || data?.contact_id || '');
  if (!/^[a-f0-9]{24}$/i.test(id)) throw fail('Контакт пользователя не найден в SendPulse', 422);
  return { id, tags: Array.isArray(data.tags) ? data.tags : [] };
}
export async function saveBookOrder({ invoiceId, bookKey, telegramId, contactId, offerId, email }) {
  if (!UUID.test(invoiceId) || !UUID.test(offerId) || !TAG_BY_BOOK[bookKey]) throw fail('Ошибка данных заказа', 422);
  const db = sql();
  await db`
    INSERT INTO book_orders
      (invoice_id, book_key, telegram_user_id, sendpulse_contact_id, offer_id, email_sha256)
    VALUES
      (${invoiceId}::uuid, ${bookKey}, ${String(telegramId)}::bigint, ${contactId}, ${offerId}::uuid, ${emailDigest(email)})
    ON CONFLICT (invoice_id) DO NOTHING
  `;
}
export async function loadBookOrder(invoiceId) {
  if (!UUID.test(invoiceId)) return null;
  const db = sql();
  const found = await db`
    SELECT invoice_id::text AS invoice_id, book_key, telegram_user_id::text AS telegram_user_id,
      sendpulse_contact_id, offer_id::text AS offer_id,
      email_sha256, tagged_at IS NOT NULL AS tagged
    FROM book_orders WHERE invoice_id = ${invoiceId}::uuid LIMIT 1
  `;
  return found[0] || null;
}
export function invoicePaid(invoice) {
  const raw = String(invoice?.status ?? invoice?.paymentStatus ?? invoice?.contractStatus ?? '').toLowerCase();
  return ['completed','success','successful','paid','succeeded','payment.success'].includes(raw);
}
export function invoiceMatchesOrder(invoice, order) {
  const offer = invoice?.offerId || invoice?.offer?.id || invoice?.product?.offerId || invoice?.tierId;
  if (offer && String(offer).toLowerCase() !== String(order.offer_id).toLowerCase()) return false;
  const mail = invoice?.buyer?.email || invoice?.customerEmail || invoice?.email;
  if (mail && emailDigest(mail) !== order.email_sha256) return false;
  return true;
}
export async function verifyLavaInvoice(invoiceId) {
  if (!UUID.test(invoiceId)) throw fail('Неверный номер счёта', 400);
  const key = process.env.LAVA_TOP_API_KEY;
  if (!key) throw fail('Lava.top не настроена', 503);
  const response = await fetch('https://gate.lava.top/api/v1/invoices/' + encodeURIComponent(invoiceId), {
    headers: { 'X-Api-Key': key, Accept: 'application/json' },
    signal: AbortSignal.timeout(3800), cache: 'no-store',
  });
  if (!response.ok) throw fail('Не удалось проверить платёж Lava.top');
  const payload = await response.json();
  return payload?.data?.invoice || payload?.data || payload?.result || payload;
}
function hasTag(tags, name) {
  return tags.some(tag => (typeof tag === 'string' ? tag : tag?.name) === name);
}
export async function tagPaidInvoice(invoiceId, knownInvoice) {
  const order = await loadBookOrder(invoiceId);
  if (!order) return { outcome: 'unknown' };
  if (order.tagged) return { outcome: 'already_tagged', bookKey: order.book_key };
  const verified = knownInvoice || await verifyLavaInvoice(invoiceId);
  if (!invoicePaid(verified)) return { outcome: 'not_paid', bookKey: order.book_key };
  if (!invoiceMatchesOrder(verified, order)) throw fail('Оплаченный счёт не соответствует заказу', 409);
  const db = sql();
  const lock = await db`
    UPDATE book_orders
    SET tag_lock_until = now() + interval '75 seconds'
    WHERE invoice_id = ${invoiceId}::uuid
      AND tagged_at IS NULL
      AND (tag_lock_until IS NULL OR tag_lock_until < now())
    RETURNING book_key
  `;
  if (!lock.length) return { outcome: 'in_progress', bookKey: order.book_key };
  try {
    const current = await findSendpulseContact(order.telegram_user_id);
    if (current.id !== order.sendpulse_contact_id) throw fail('Контакт SendPulse изменился', 409);
    const tag = TAG_BY_BOOK[order.book_key];
    if (!hasTag(current.tags, tag)) {
      await spFetch('/contacts/setTag', {
        method: 'POST',
        body: JSON.stringify({ contact_id: current.id, tags: [tag] }),
      });
    }
    await db`
      UPDATE book_orders SET tagged_at = now(), tag_lock_until = NULL
      WHERE invoice_id = ${invoiceId}::uuid
    `;
    return { outcome: 'tagged', bookKey: order.book_key };
  } catch (error) {
    await db`
      UPDATE book_orders SET tag_lock_until = NULL
      WHERE invoice_id = ${invoiceId}::uuid AND tagged_at IS NULL
    `.catch(() => {});
    throw error;
  }
}
