const ROOT='https://api.frankfurter.dev/v2/rate/thb/usd';
let cached=null;
export async function thbUsdRate({fetchImpl=fetch,now=Date.now(),force=false}={}){
  if(!force&&cached&&now-cached.fetchedAt<15*60*1000)return cached.rate;
  const response=await fetchImpl(ROOT,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(9000)});
  if(!response.ok)throw new Error('FX feed unavailable');
  const data=await response.json();
  const rate=Number(data.rate),date=Date.parse(`${data.date}T00:00:00Z`);
  if(data.base!=='THB'||data.quote!=='USD'||!Number.isFinite(rate)||rate<=0||rate>=1||!Number.isFinite(date)||now-date<0||now-date>5*86400000)throw new Error('FX feed stale/invalid');
  cached={fetchedAt:now,rate};return rate;
}
// Price cost is in THB cents; all public prices/receipts are USD/USDT cents.
export function quoteUsdCents(costThbCents,markupPercent,rate){
  if(!Number.isSafeInteger(costThbCents)||costThbCents<0||!Number.isInteger(markupPercent)||markupPercent<0||markupPercent>500||!Number.isFinite(rate)||rate<=0||rate>=1)throw new Error('Invalid quote');
  // 3% FX buffer prevents a small THB/USD move creating an accidental loss.
  return Math.ceil(costThbCents * rate * (100+markupPercent)/100 * 1.03);
}
export function invoiceUnits(usdCents,suffix){
  if(!Number.isSafeInteger(usdCents)||usdCents<1||!Number.isSafeInteger(suffix)||suffix<1||suffix>9999)throw new Error('Invalid invoice');
  const amount=usdCents*10000+suffix;if(!Number.isSafeInteger(amount))throw new Error('Invoice amount too large');return amount;
}
export function formatUsdt(units){if(!Number.isSafeInteger(units)||units<0)throw new Error('Invalid amount');return (units/1e6).toFixed(6);}
