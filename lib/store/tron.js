// Read-only TRONSCAN transaction verification. Does not hold signing keys.
import {validWallet} from './core.js';
import {PAYMENT_WINDOW_MS} from './payment-window.js';
export const USDT_TRC20='TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
export const canVerifyTron=()=>!!process.env.STORE_TRONSCAN_API_KEY;
export function validateTronTransfer(transaction,{txid,wallet,units,createdAt,now=Date.now()}={}){
  if(!/^[a-f0-9]{64}$/i.test(txid||'')||!validWallet(wallet)||!Number.isSafeInteger(units)||units<1)return false;
  if(transaction?.hash?.toLowerCase()!==txid.toLowerCase()||transaction.confirmed!==true||transaction.revert!==false||transaction.contractRet!=='SUCCESS'||!Number.isInteger(transaction.confirmations)||transaction.confirmations<20)return false;
  const timestamp=Number(transaction.timestamp),created=Date.parse(createdAt);
  if(!Number.isFinite(timestamp)||!Number.isFinite(created)||timestamp<created||timestamp>now+90000||timestamp>=created+PAYMENT_WINDOW_MS)return false;
  return (transaction.trc20TransferInfo||[]).some(t=>t.contract_address===USDT_TRC20&&t.to_address===wallet&&t.type==='Transfer'&&t.decimals===6&&t.status===0&&/^\d+$/.test(String(t.amount_str))&&BigInt(t.amount_str)===BigInt(units));
}
export async function verifyTronPayment({txid,wallet,units,createdAt,fetchImpl=fetch,now=Date.now()}){
  if(!canVerifyTron())throw new Error('TRON verification is not configured');
  if(!/^[a-f0-9]{64}$/i.test(txid||''))return false;
  const url=`https://apilist.tronscanapi.com/api/transaction-info?hash=${txid.toLowerCase()}`;
  const response=await fetchImpl(url,{headers:{'TRON-PRO-API-KEY':process.env.STORE_TRONSCAN_API_KEY,Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error('TRON verification feed unavailable');
  const payload=await response.json();
  if(!payload||typeof payload!=='object')throw new Error('TRON verification malformed');
  return validateTronTransfer(payload,{txid,wallet,units,createdAt,now});
}
