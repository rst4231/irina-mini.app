import {decryptDelivery,equalsSecret,json,guardMethod,sha256} from '../../lib/store/core.js';
import {order} from '../../lib/store/db.js';
export default async function handler(req,res){
  if(!guardMethod(req,res,['POST']))return;
  const {id,token}=req.body||{};
  if(typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id)||typeof token!=='string'||token.length<30)return json(res,400,{error:'Invalid receipt'});
  try{
    const value=await order(id);
    if(!value||!equalsSecret(sha256(token),value.lookup_hash))return json(res,404,{error:'Order not found'});
    const delivered=value.status==='fulfilled'&&value.delivery_ciphertext ? decryptDelivery(value.delivery_ciphertext):null;
    return json(res,200,{id:value.id,status:value.status,title:value.product_title,quantity:value.quantity,total:value.total_cents/100,network:value.pay_network,wallet:value.pay_wallet,createdAt:value.created_at,items:delivered});
  }catch(error){console.error('Order receipt failed',error.message);return json(res,503,{error:'Order lookup unavailable'});}
}
