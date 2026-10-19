import {db,order} from '../../lib/store/db.js';
import {equalsSecret,guardMethod,json,sha256} from '../../lib/store/core.js';
import {telegramUserFromInitData} from '../../lib/store/telegram.js';

export default async function handler(req,res){
  if(!guardMethod(req,res,['POST']))return;
  if(req.headers.origin){
    try{if(new URL(req.headers.origin).host!==req.headers.host)return json(res,403,{error:'Invalid origin'});}
    catch{return json(res,403,{error:'Invalid origin'});}
  }
  const {initData,action='list',page=0,id,token}=req.body||{};
  const user=telegramUserFromInitData(initData);
  if(!user)return json(res,401,{error:'Откройте магазин через Telegram Mini App'});
  if(!['list','claim'].includes(action))return json(res,400,{error:'Invalid account action'});
  if(action==='list'&&(!Number.isSafeInteger(page)||page<0||page>200))return json(res,400,{error:'Invalid page'});
  try{
    await db('rpc/store_upsert_user',{method:'POST',body:user});
    if(action==='claim'){
      if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id)||typeof token!=='string'||token.length<30)return json(res,400,{error:'Invalid receipt'});
      const record=await order(id);
      if(!record||!equalsSecret(sha256(token),record.lookup_hash))return json(res,404,{error:'Order not found'});
      const claimed=await db('rpc/store_claim_order',{method:'POST',body:{id,telegram_id:user.telegram_id}});
      if(!claimed[0]?.claimed)return json(res,409,{error:'Заказ принадлежит другому пользователю'});
      return json(res,200,{ok:true});
    }
    const size=50;
    const rows=await db('store_orders',{query:`select=id,product_title,quantity,total_cents,status,created_at&telegram_user_id=eq.${user.telegram_id}&order=created_at.desc&limit=${size}&offset=${page*size}`});
    return json(res,200,{user:{firstName:user.first_name,username:user.username},orders:rows.map(v=>({id:v.id,title:v.product_title,quantity:v.quantity,total:v.total_cents/100,status:v.status,createdAt:v.created_at})),hasMore:rows.length===size});
  }catch(e){console.error('Store account failure',String(e.message).slice(0,100));return json(res,503,{error:'Личный кабинет временно недоступен'});}
}
