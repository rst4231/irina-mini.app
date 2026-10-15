import { loadBookOrder, UUID, verifyLavaInvoice, invoicePaid, invoiceMatchesOrder, tagPaidInvoice } from './order-tags.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') {
    res.setHeader('Allow','GET');
    return res.status(405).json({ok:false,error:'method_not_allowed'});
  }
  const invoiceId = String(req.query?.invoiceId || '');
  if (!UUID.test(invoiceId)) return res.status(400).json({ok:false,error:'invalid_invoice'});
  try {
    const order = await loadBookOrder(invoiceId);
    if (!order) return res.status(404).json({ok:false,error:'unknown_invoice'});
    const invoice = await verifyLavaInvoice(invoiceId);
    if (!invoiceMatchesOrder(invoice, order)) return res.status(409).json({ok:false,error:'invoice_mismatch'});
    const paid = invoicePaid(invoice);
    // Recovery path if Lava redirected before the webhook arrived.
    if (paid && !order.tagged) {
      try { await tagPaidInvoice(invoiceId, invoice); }
      catch (error) { console.error('book_tag_recovery_error', error?.message || 'unknown'); }
    }
    return res.status(200).json({ok:true,paid,pending:!paid});
  } catch {
    return res.status(502).json({ok:false,error:'verification_unavailable'});
  }
}
