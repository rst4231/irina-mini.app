import crypto from 'node:crypto';
import { tagPaidInvoice, UUID, emailDigest, loadBookOrder } from './order-tags.js';

function authorized(value, expected) {
  if (typeof value !== 'string' || !value || !expected) return false;
  const got = Buffer.from(value);
  const secret = Buffer.from(expected);
  return got.length === secret.length && crypto.timingSafeEqual(got, secret);
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ok:false,error:'method_not_allowed'});
  }
  if (!authorized(req.headers['x-api-key'], process.env.LAVA_TOP_WEBHOOK_KEY)) {
    return res.status(401).json({ok:false,error:'unauthorized'});
  }
  const event = req.body && typeof req.body === 'object' ? req.body : {};
  const type = String(event.eventType || event.event_type || event.type || '').toLowerCase();
  // Refunds, failed payments, and unknown events must never grant tags.
  if (type !== 'payment.success') return res.status(200).json({ok:true,ignored:true});
  const invoiceId = String(event.contractId || event.invoiceId || event.data?.invoiceId || '');
  if (!UUID.test(invoiceId)) return res.status(400).json({ok:false,error:'missing_contract_id'});
  try {
    const order = await loadBookOrder(invoiceId);
    // Other Lava products may send events to this URL; do not tag those.
    if (!order) return res.status(200).json({ok:true,ignored:true});
    const buyerEmail = event?.buyer?.email || event?.customerEmail || '';
    if (buyerEmail && emailDigest(buyerEmail) !== order.email_sha256) {
      return res.status(409).json({ok:false,error:'buyer_mismatch'});
    }
    const result = await tagPaidInvoice(invoiceId);
    if (result.outcome === 'not_paid' || result.outcome === 'in_progress') {
      // Lava automatically retries non-2xx deliveries.
      return res.status(503).json({ok:false,error:'retry_later'});
    }
    console.info('book_purchase_tag_handled', {invoiceId, result:result.outcome, book:result.bookKey});
    return res.status(200).json({ok:true,result:result.outcome});
  } catch (error) {
    console.error('book_tag_error', {invoiceId, message:error?.message || 'unknown'});
    return res.status(503).json({ok:false,error:'sendpulse_tag_pending'});
  }
}
