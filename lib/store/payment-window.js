import {order,transition} from './db.js';
export const PAYMENT_WINDOW_MS=50*60*1000;
export const paymentTimedOut=record=>record?.status==='cancelled'&&record.error_message==='payment_timeout';
export async function claimVerifiedPayment(record,txHash){
  // The blockchain verifier checks that the transfer arrived within 50 minutes.
  // An expiry sweep can race that check, so a timed-out invoice may recover
  // with valid payment proof. A manually cancelled order cannot recover.
  let claimed=await transition(record.id,record.status,'fulfilling',{payment_tx_hash:txHash});
  if(!claimed&&record.status==='awaiting_payment'){
    const latest=await order(record.id);
    if(paymentTimedOut(latest))claimed=await transition(record.id,'cancelled','fulfilling',{payment_tx_hash:txHash});
  }
  return claimed;
}
