const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ok:false,error:'method_not_allowed'});
  }
  const invoiceId = String(req.query?.invoiceId || '');
  if (!UUID.test(invoiceId)) return res.status(400).json({ok:false,error:'invalid_invoice'});
  if (!process.env.LAVA_TOP_API_KEY) return res.status(503).json({ok:false,error:'not_configured'});
  try {
    const response = await fetch('https://gate.lava.top/api/v1/invoices/' + encodeURIComponent(invoiceId), {
      headers: { 'X-Api-Key': process.env.LAVA_TOP_API_KEY, Accept: 'application/json' },
      signal: AbortSignal.timeout(8500),
      cache: 'no-store',
    });
    if (!response.ok) return res.status(502).json({ok:false,error:'verification_unavailable'});
    const data = await response.json();
    const record = data?.data ?? data?.result ?? data;
    const status = String(record?.status ?? record?.paymentStatus ?? '').toLowerCase();
    const paid = ['completed','success','successful','paid','succeeded','payment.success'].includes(status);
    return res.status(200).json({ok:true,paid,pending:!paid});
  } catch {
    return res.status(502).json({ok:false,error:'verification_unavailable'});
  }
}
