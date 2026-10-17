import {randomUUID} from 'node:crypto';
import {db,hasDb,product,settings} from '../../lib/store/db.js';
import {currency,json,guardMethod,moneyToCents,newLookupToken,sha256,sellPrice,validEmail,validWallet} from '../../lib/store/core.js';
import {hasSupplier,readListing} from '../../lib/store/supplier.js';

export default async function handler(req,res){
  if(!guardMethod(req,res,['POST']))return;
  const origin=req.headers.origin;
  if(origin){try{if(new URL(origin).host!==req.headers.host)return json(res,403,{error:'Invalid request origin'});}catch{return json(res,403,{error:'Invalid request origin'});}}
  const {productId,quantity,email,honey=''}=req.body||{};
  if(honey)return json(res,400,{error:'Invalid request'});
  if(!Number.isSafeInteger(productId) || !Number.isSafeInteger(quantity)||quantity<1||quantity>20||!validEmail(email))return json(res,400,{error:'Неверные данные заказа'});
  if(!hasDb()||!hasSupplier())return json(res,503,{error:'Магазин пока не принимает заказы'});
  try{
    const config=await settings();
    if(config.checkout_enabled!==true || !validWallet(config.usdt_trc20_wallet) || !config.supplier_resale_approved)return json(res,503,{error:'Оплата пока не подключена'});
    const record=await product(productId);
    if(!record || !record.published || !record.stock)return json(res,404,{error:'Товар недоступен'});
    const latest=await readListing(record.slug);
    if(latest.provider_listing_id!==record.provider_listing_id || latest.stock<quantity)return json(res,409,{error:'Товар закончился. Обновите каталог'});
    const markup=Number(config.markup_pct??45);
    const unit=sellPrice(latest.supplier_price_cents,markup);
    const id=randomUUID();const token=newLookupToken();
    const forwarded=String(req.headers['x-forwarded-for']||'').split(',')[0].trim();
    const remote=forwarded||req.socket?.remoteAddress||'unknown';
    const ipHash=sha256(`${process.env.STORE_ADMIN_TOKEN||'adsupply'}:${remote}`);
    const hourAgo=new Date(Date.now()-3600000).toISOString();
    const recent=await db('store_orders',{query:`select=id&ip_hash=eq.${ipHash}&created_at=gte.${encodeURIComponent(hourAgo)}&limit=6`});
    if(recent.length>=5)return json(res,429,{error:'Слишком много заказов. Попробуйте позднее.'});
    const wallet=String(config.usdt_trc20_wallet);
    await db('store_orders',{method:'POST',prefer:'return=minimal',body:{id,lookup_hash:sha256(token),customer_email:email.toLowerCase().trim(),product_id:record.id,product_title:record.title,quantity,unit_price_cents:unit,supplier_unit_price_cents:latest.supplier_price_cents,total_cents:unit*quantity,pay_network:'TRC20',pay_wallet:wallet,status:'awaiting_payment',ip_hash:ipHash}});
    return json(res,201,{id,token,status:'awaiting_payment',total:currency(unit*quantity),currency:'USDT',network:'TRC20',wallet,notice:'Оплата проверяется вручную. Не отправляйте средства до проверки кошелька и реквизитов.'});
  }catch(error){console.error('Create order failed',error.message);return json(res,503,{error:'Не удалось создать заказ. Попробуйте позже.'});}
}
