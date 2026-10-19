import {decryptDelivery,equalsSecret,json,guardMethod,sha256} from '../../lib/store/core.js';
import {order} from '../../lib/store/db.js';
import {formatUsdt} from '../../lib/store/fx.js';
import {telegramUserFromInitData} from '../../lib/store/telegram.js';
export default async function handler(req,res){
  if(!guardMethod(req,res,['POST']))return;
  const {id,token,initData}=req.body||{};
  if(typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id))return json(res,400,{error:'Invalid receipt'});
  const user=initData?telegramUserFromInitData(initData):null;
  try{
    const v=await order(id);
    if(!v||!((typeof token==='string'&&token.length>=30&&equalsSecret(sha256(token),v.lookup_hash))||(user&&v.telegram_user_id===user.telegram_id)))return json(res,404,{error:'Order not found'});
    const items=v.status==='fulfilled'&&v.delivery_ciphertext?decryptDelivery(v.delivery_ciphertext):null;
    return json(res,200,{id:v.id,status:v.status,title:v.product_title,quantity:v.quantity,total:v.total_cents/100,payAmount:Number.isSafeInteger(v.pay_amount_micro)?formatUsdt(v.pay_amount_micro):null,network:v.pay_network,wallet:v.pay_wallet,createdAt:v.created_at,items});
  }catch(error){console.error('Order receipt failed',error.message);return json(res,503,{error:'Order lookup unavailable'});}
}
