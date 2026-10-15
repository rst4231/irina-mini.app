import crypto from 'node:crypto';
function authorized(value, expected) {
  if (typeof value !== 'string' || !value || !expected) return false;
  const got = Buffer.from(value);
  const secret = Buffer.from(expected);
  return got.length === secret.length && crypto.timingSafeEqual(got, secret);
}
export default function handler(req, res) {
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
  const kind = String(event.eventType || event.event_type || event.type || event.event || 'unknown').slice(0,64);
  const invoiceId = String(event.invoiceId || event.invoice?.id || event.data?.invoiceId || '').slice(0,48);
  // No customer data or secret ever written to server logs.
  console.info('lava_webhook_received', {event:kind, invoiceId});
  // Acknowledge unknown events as required by Lava; payment truth is checked
  // from the invoice API, not from a forgeable browser return URL.
  return res.status(200).json({ok:true});
}
