import {order,settings} from '../../lib/store/db.js';
import {equalsSecret,json,guardMethod,sha256} from '../../lib/store/core.js';
import {verifyTronPayment} from '../../lib/store/tron.js';
import {fulfill} from '../../lib/store/fulfill.js';
import {telegramUserFromInitData} from '../../lib/store/telegram.js';
import {claimVerifiedPayment,paymentTimedOut} from '../../lib/store/payment-window.js';
export default async function handler(req,res){
  if(!guardMethod(req,res,['POST']))return;
  const {id,token,txHash,initData}=req.body||{};
  if(typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id)||typeof txHash!=='string'||!/^[a-f0-9]{64}$/i.test(txHash))return json(res,400,{error:'Invalid payment proof'});
  try{
    const record=await order(id);
    const user=initData?telegramUserFromInitData(initData):null;
    if(!record||!((typeof token==='string'&&token.length>=30&&equalsSecret(sha256(token),record.lookup_hash))||(user&&record.telegram_user_id===user.telegram_id)))return json(res,404,{error:'Order not found'});
    if(record.status!=='awaiting_payment'&&!paymentTimedOut(record))return json(res,200,{status:record.status});
    if(!Number.isSafeInteger(record.pay_amount_micro)||!record.pay_wallet)return json(res,409,{error:'Invoice is invalid'});
    const paid=await verifyTronPayment({txid:txHash,wallet:record.pay_wallet,units:record.pay_amount_micro,createdAt:record.created_at});
    if(!paid)return json(res,422,{error:'Транзакция ещё не подтверждена или не совпадают токен, адрес, время и точная сумма'});
    const claimed=await claimVerifiedPayment(record,txHash.toLowerCase());
    if(!claimed)return json(res,409,{error:'Payment already processing or TXID used'});
    const cfg=await settings();
    if(cfg.auto_fulfillment_enabled!==true||process.env.STORE_ALLOW_AUTOFULFILL!=='true')return json(res,200,{status:'fulfilling',message:'Payment verified; awaiting seller fulfillment'});
    const result=await fulfill(id);
    return json(res,200,result);
  }catch(error){console.error('Store payment verify failed',String(error.message).slice(0,120));return json(res,503,{error:'Payment verification unavailable; retry later'});}
}
